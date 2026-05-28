package com.company.inspection.realtime;

import com.company.inspection.user.UserRole;

public record RealtimeSessionInfo(
        Long userId,
        String username,
        UserRole role,
        Long requestId
) {
}

