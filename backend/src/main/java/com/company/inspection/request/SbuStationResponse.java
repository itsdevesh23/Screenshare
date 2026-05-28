package com.company.inspection.request;

public record SbuStationResponse(
        Long userId,
        String username,
        boolean hasPendingRequest,
        boolean hasAcceptedSession
) {
}

