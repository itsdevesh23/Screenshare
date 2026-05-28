package com.company.inspection.request;

import java.time.Instant;

public record AccessRequestResponse(
        Long id,
        Long inspectorId,
        String inspectorUsername,
        Long sbuId,
        String sbuUsername,
        InspectionRequestStatus status,
        Instant createdAt,
        Instant respondedAt,
        Instant endedAt
) {
    public static AccessRequestResponse from(InspectionRequest request) {
        return new AccessRequestResponse(
                request.getId(),
                request.getInspector().getId(),
                request.getInspector().getUsername(),
                request.getSbu().getId(),
                request.getSbu().getUsername(),
                request.getStatus(),
                request.getCreatedAt(),
                request.getRespondedAt(),
                request.getEndedAt()
        );
    }
}

