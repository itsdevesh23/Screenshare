package com.company.inspection.realtime;

import com.company.inspection.request.AccessRequestService;
import com.company.inspection.request.AccessRequestResponse;
import com.company.inspection.security.TokenService;
import com.company.inspection.user.UserRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {

    private final TokenService tokenService;
    private final AccessRequestService accessRequestService;
    private final ObjectMapper objectMapper;
    private final Map<Long, Set<WebSocketSession>> sessionsByRequest = new ConcurrentHashMap<>();

    public RealtimeWebSocketHandler(
            TokenService tokenService,
            AccessRequestService accessRequestService,
            ObjectMapper objectMapper
    ) {
        this.tokenService = tokenService;
        this.accessRequestService = accessRequestService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        RealtimeSessionInfo info = authenticate(session.getUri());
        session.getAttributes().put("info", info);
        sessionsByRequest.computeIfAbsent(info.requestId(), key -> ConcurrentHashMap.newKeySet()).add(session);

        send(session, Map.of(
                "type", "connected",
                "requestId", info.requestId(),
                "payload", Map.of("username", info.username(), "role", info.role().name())
        ));
        broadcastExcept(session, Map.of(
                "type", "peer-joined",
                "requestId", info.requestId(),
                "payload", Map.of("username", info.username(), "role", info.role().name())
        ));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        RealtimeSessionInfo info = getInfo(session);
        RealtimeMessage realtimeMessage = objectMapper.readValue(message.getPayload(), RealtimeMessage.class);

        if (!info.requestId().equals(realtimeMessage.requestId())) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Invalid request id"));
            return;
        }

        broadcastExcept(session, Map.of(
                "type", realtimeMessage.type(),
                "requestId", realtimeMessage.requestId(),
                "payload", realtimeMessage.payload() == null ? objectMapper.createObjectNode() : realtimeMessage.payload()
        ));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        RealtimeSessionInfo info = getInfo(session);
        if (info != null) {
            Set<WebSocketSession> sessions = sessionsByRequest.get(info.requestId());
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    sessionsByRequest.remove(info.requestId());
                }
            }
            broadcastExcept(session, Map.of(
                    "type", "peer-left",
                    "requestId", info.requestId(),
                    "payload", Map.of("username", info.username(), "role", info.role().name())
            ));
        }
    }

    private RealtimeSessionInfo authenticate(URI uri) {
        Map<String, String> params = UriComponentsBuilder.fromUri(uri).build().getQueryParams().toSingleValueMap();
        String token = params.get("token");
        String requestIdValue = params.get("requestId");

        if (token == null || requestIdValue == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing realtime credentials");
        }

        Long requestId = Long.valueOf(requestIdValue);
        AccessRequestResponse request = accessRequestService.getAcceptedRequest(requestId);

        return tokenService.validate(token)
                .filter(claims -> isParticipant(claims.userId(), claims.role(), request))
                .map(claims -> new RealtimeSessionInfo(claims.userId(), claims.username(), claims.role(), requestId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid realtime token"));
    }

    private boolean isParticipant(Long userId, UserRole role, AccessRequestResponse request) {
        if (role == UserRole.INSPECTOR) {
            return request.inspectorId().equals(userId);
        }
        if (role == UserRole.SBU) {
            return request.sbuId().equals(userId);
        }
        return false;
    }

    private RealtimeSessionInfo getInfo(WebSocketSession session) {
        return (RealtimeSessionInfo) session.getAttributes().get("info");
    }

    private void broadcastExcept(WebSocketSession sender, Object payload) throws Exception {
        RealtimeSessionInfo info = getInfo(sender);
        if (info == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionsByRequest.get(info.requestId());
        if (sessions == null) {
            return;
        }

        TextMessage message = new TextMessage(objectMapper.writeValueAsString(payload));
        for (WebSocketSession candidate : sessions) {
            if (candidate.isOpen() && !candidate.getId().equals(sender.getId())) {
                candidate.sendMessage(message);
            }
        }
    }

    private void send(WebSocketSession session, Object payload) throws Exception {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
        }
    }
}
