package com.company.inspection.auth;

import com.company.inspection.user.UserRole;

public record LoginResponse(
        String token,
        Long userId,
        String username,
        UserRole role
) {
}

