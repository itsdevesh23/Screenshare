package com.company.inspection.security;

import com.company.inspection.user.AppUser;
import com.company.inspection.user.UserRole;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

@Service
public class TokenService {

    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final String secret;
    private final long tokenValidityMinutes;

    public TokenService(
            ObjectMapper objectMapper,
            @Value("${app.security.jwt-secret}") String secret,
            @Value("${app.security.token-validity-minutes}") long tokenValidityMinutes
    ) {
        this.objectMapper = objectMapper;
        this.secret = secret;
        this.tokenValidityMinutes = tokenValidityMinutes;
    }

    public String createToken(AppUser user) {
        try {
            String header = encodeJson(Map.of("alg", "HS256", "typ", "JWT"));
            String payload = encodeJson(Map.of(
                    "sub", user.getUsername(),
                    "uid", user.getId(),
                    "role", user.getRole().name(),
                    "exp", Instant.now().plusSeconds(tokenValidityMinutes * 60).getEpochSecond()
            ));
            String signature = sign(header + "." + payload);
            return header + "." + payload + "." + signature;
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not create token", ex);
        }
    }

    public Optional<TokenClaims> validate(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Optional.empty();
            }

            String signedContent = parts[0] + "." + parts[1];
            if (!constantTimeEquals(sign(signedContent), parts[2])) {
                return Optional.empty();
            }

            Map<?, ?> claims = objectMapper.readValue(BASE64_URL_DECODER.decode(parts[1]), Map.class);
            long expiresAt = ((Number) claims.get("exp")).longValue();
            if (Instant.now().getEpochSecond() > expiresAt) {
                return Optional.empty();
            }

            return Optional.of(new TokenClaims(
                    ((Number) claims.get("uid")).longValue(),
                    (String) claims.get("sub"),
                    UserRole.valueOf((String) claims.get("role"))
            ));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String encodeJson(Map<String, Object> value) throws JsonProcessingException {
        return BASE64_URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return BASE64_URL_ENCODER.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not sign token", ex);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left.length() != right.length()) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < left.length(); i++) {
            result |= left.charAt(i) ^ right.charAt(i);
        }
        return result == 0;
    }
}

