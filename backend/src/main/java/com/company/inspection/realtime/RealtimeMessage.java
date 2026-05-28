package com.company.inspection.realtime;

import com.fasterxml.jackson.databind.JsonNode;

public record RealtimeMessage(
        String type,
        Long requestId,
        JsonNode payload
) {
}

