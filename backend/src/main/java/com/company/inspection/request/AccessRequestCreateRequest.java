package com.company.inspection.request;

import jakarta.validation.constraints.NotNull;

public record AccessRequestCreateRequest(
        @NotNull Long sbuUserId
) {
}

