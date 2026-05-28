package com.company.inspection.security;

import com.company.inspection.user.UserRole;

public record TokenClaims(
        Long userId,
        String username,
        UserRole role
) {
}

