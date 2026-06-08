package com.company.inspection.realtime;

import com.company.inspection.user.UserRole;
import com.company.inspection.request.AccessLevel;

public record RealtimeSessionInfo(
        Long userId,
        String username,
        UserRole role,
        Long requestId,
        AccessLevel accessLevel
) {
}

