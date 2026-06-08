package com.company.inspection.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.awt.AWTException;
import java.awt.Dimension;
import java.awt.GraphicsEnvironment;
import java.awt.Robot;
import java.awt.Toolkit;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;

public class SbuAgentApplication {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        Map<String, String> options = parseArgs(args);
        String backendUrl = options.getOrDefault("backend", "http://127.0.0.1:8080");
        String username = options.getOrDefault("username", "sbu1");
        String password = options.getOrDefault("password", "password");

        if (GraphicsEnvironment.isHeadless()) {
            throw new IllegalStateException("SBU agent needs a desktop session. Headless mode cannot control mouse input.");
        }

        HttpClient httpClient = HttpClient.newHttpClient();
        Robot robot = createRobot();
        String token = login(httpClient, backendUrl, username, password);

        System.out.println("SBU agent logged in as " + username);
        System.out.println("Waiting for an accepted inspection request...");

        while (true) {
            Optional<Long> acceptedRequestId = findAcceptedRequest(httpClient, backendUrl, token);
            if (acceptedRequestId.isPresent()) {
                connectRealtime(httpClient, backendUrl, token, acceptedRequestId.get(), robot);
            }
            Thread.sleep(2000);
        }
    }

    private static Robot createRobot() throws AWTException {
        Robot robot = new Robot();
        robot.setAutoDelay(50);
        return robot;
    }

    private static String login(HttpClient httpClient, String backendUrl, String username, String password)
            throws IOException, InterruptedException {
        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("username", username);
        body.put("password", password);

        HttpRequest request = HttpRequest.newBuilder(URI.create(backendUrl + "/api/auth/login"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Login failed: HTTP " + response.statusCode() + " " + response.body());
        }

        return OBJECT_MAPPER.readTree(response.body()).get("token").asText();
    }

    private static Optional<Long> findAcceptedRequest(HttpClient httpClient, String backendUrl, String token)
            throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(backendUrl + "/api/sbu/access-requests"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            System.out.println("Could not load SBU requests: HTTP " + response.statusCode());
            return Optional.empty();
        }

        JsonNode requests = OBJECT_MAPPER.readTree(response.body());
        for (JsonNode requestNode : requests) {
            if ("ACCEPTED".equals(requestNode.get("status").asText())) {
                return Optional.of(requestNode.get("id").asLong());
            }
        }
        return Optional.empty();
    }

    private static void connectRealtime(
            HttpClient httpClient,
            String backendUrl,
            String token,
            Long requestId,
            Robot robot
    ) throws InterruptedException {
        CountDownLatch disconnected = new CountDownLatch(1);
        String wsUrl = toWebSocketUrl(backendUrl) + "/ws/sessions?token=" + encode(token) + "&requestId=" + requestId;

        System.out.println("Connecting control agent for request " + requestId);
        WebSocket webSocket = httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(URI.create(wsUrl), new AgentWebSocketListener(robot, disconnected))
                .join();

        // Polling loop to ensure we don't hang forever if the session ends without a clean disconnect
        while (disconnected.getCount() > 0) {
            try {
                Optional<Long> activeRequest = findAcceptedRequest(httpClient, backendUrl, token);
                if (activeRequest.isEmpty() || !activeRequest.get().equals(requestId)) {
                    System.out.println("Session " + requestId + " is no longer active. Forcing disconnect.");
                    webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Session ended");
                    break;
                }
            } catch (Exception e) {
                System.out.println("Error polling request status: " + e.getMessage());
            }
            Thread.sleep(3000);
        }

        System.out.println("Realtime session disconnected. Waiting for next accepted request...");
    }

    private static String toWebSocketUrl(String backendUrl) {
        if (backendUrl.startsWith("https://")) {
            return "wss://" + backendUrl.substring("https://".length());
        }
        if (backendUrl.startsWith("http://")) {
            return "ws://" + backendUrl.substring("http://".length());
        }
        return backendUrl;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static Map<String, String> parseArgs(String[] args) {
        java.util.HashMap<String, String> options = new java.util.HashMap<>();
        for (int i = 0; i < args.length - 1; i += 2) {
            if (args[i].startsWith("--")) {
                options.put(args[i].substring(2), args[i + 1]);
            }
        }
        return options;
    }

    private static class AgentWebSocketListener implements WebSocket.Listener {

        private final Robot robot;
        private final CountDownLatch disconnected;

        AgentWebSocketListener(Robot robot, CountDownLatch disconnected) {
            this.robot = robot;
            this.disconnected = disconnected;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            System.out.println("Control agent connected.");
            WebSocket.Listener.super.onOpen(webSocket);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            webSocket.request(1);
            if (!last) {
                return null;
            }

            try {
                System.out.println("Received: " + data);
                JsonNode message = OBJECT_MAPPER.readTree(data.toString());
                if ("remote-input".equals(message.get("type").asText())) {
                    handleRemoteInput(message.get("payload"));
                }
            } catch (Exception ex) {
                System.out.println("Could not process realtime message: " + ex.getMessage());
            }

            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            disconnected.countDown();
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            System.out.println("Realtime error: " + error.getMessage());
            disconnected.countDown();
        }

        private void handleRemoteInput(JsonNode payload) {
            if (payload == null) {
                return;
            }
            
            String action = payload.path("action").asText();
            
            if ("keydown".equals(action) || "keyup".equals(action)) {
                handleKeyboardInput(action, payload);
                return;
            }

            if ("wheel".equals(action)) {
                int deltaY = payload.path("deltaY").asInt();
                // Java Robot scroll amounts are in 'notches'. Browsers often report deltaY in pixels (e.g. 100).
                // We'll normalize by taking the sign of the delta, so 1 notch down or 1 notch up per scroll event.
                int notches = (int) Math.signum(deltaY);
                if (notches != 0) {
                    robot.mouseWheel(notches);
                }
                return;
            }

            if (!"mousemove".equals(action) && !"mousedown".equals(action) && !"mouseup".equals(action) && !"click".equals(action) && !"browser-click".equals(action)) {
                return;
            }

            Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
            int x = (int) Math.round(payload.path("xRatio").asDouble() * screenSize.width);
            int y = (int) Math.round(payload.path("yRatio").asDouble() * screenSize.height);
            int buttonMask = InputEvent.BUTTON1_DOWN_MASK;

            robot.mouseMove(clamp(x, 0, screenSize.width - 1), clamp(y, 0, screenSize.height - 1));

            if ("mousedown".equals(action) || "click".equals(action) || "browser-click".equals(action)) {
                robot.mousePress(buttonMask);
            }
            if ("mouseup".equals(action) || "click".equals(action) || "browser-click".equals(action)) {
                robot.mouseRelease(buttonMask);
            }
        }

        private void handleKeyboardInput(String action, JsonNode payload) {
            int jsKeyCode = payload.path("keyCode").asInt();
            String key = payload.path("key").asText();
            
            int javaKeyCode = mapKeyCode(jsKeyCode, key);
            if (javaKeyCode == -1) {
                return; // Unsupported key
            }

            try {
                if ("keydown".equals(action)) {
                    robot.keyPress(javaKeyCode);
                } else if ("keyup".equals(action)) {
                    robot.keyRelease(javaKeyCode);
                }
            } catch (IllegalArgumentException e) {
                System.out.println("Invalid keycode generated: " + javaKeyCode + " for JS key: " + key);
            }
        }

        private int mapKeyCode(int jsKeyCode, String key) {
            // Standard alphanumeric mappings
            if (jsKeyCode >= 65 && jsKeyCode <= 90) return jsKeyCode; // A-Z
            if (jsKeyCode >= 48 && jsKeyCode <= 57) return jsKeyCode; // 0-9
            
            // Map common control keys
            return switch (key) {
                case "Enter" -> KeyEvent.VK_ENTER;
                case "Backspace" -> KeyEvent.VK_BACK_SPACE;
                case "Tab" -> KeyEvent.VK_TAB;
                case "Shift" -> KeyEvent.VK_SHIFT;
                case "Control" -> KeyEvent.VK_CONTROL;
                case "Alt" -> KeyEvent.VK_ALT;
                case "Escape" -> KeyEvent.VK_ESCAPE;
                case " " -> KeyEvent.VK_SPACE;
                case "ArrowUp" -> KeyEvent.VK_UP;
                case "ArrowDown" -> KeyEvent.VK_DOWN;
                case "ArrowLeft" -> KeyEvent.VK_LEFT;
                case "ArrowRight" -> KeyEvent.VK_RIGHT;
                case "Delete" -> KeyEvent.VK_DELETE;
                case "Meta", "OS" -> KeyEvent.VK_WINDOWS;
                case "." -> KeyEvent.VK_PERIOD;
                case "," -> KeyEvent.VK_COMMA;
                case "/" -> KeyEvent.VK_SLASH;
                case ";" -> KeyEvent.VK_SEMICOLON;
                case "=" -> KeyEvent.VK_EQUALS;
                case "-" -> KeyEvent.VK_MINUS;
                default -> -1;
            };
        }

        private int clamp(int value, int min, int max) {
            return Math.max(min, Math.min(max, value));
        }
    }
}

