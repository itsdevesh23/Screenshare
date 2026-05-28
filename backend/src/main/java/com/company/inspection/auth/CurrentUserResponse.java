package com.company.inspection.auth;

import com.company.inspection.user.UserRole;

public record CurrentUserResponse(
        Long userId,
        String username,
        UserRole role
) {
}

