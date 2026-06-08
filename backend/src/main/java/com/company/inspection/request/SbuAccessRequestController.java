package com.company.inspection.request;

import com.company.inspection.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RestController
@RequestMapping("/api/sbu/access-requests")
public class SbuAccessRequestController {

    private final AccessRequestService accessRequestService;

    public SbuAccessRequestController(AccessRequestService accessRequestService) {
        this.accessRequestService = accessRequestService;
    }

    @GetMapping
    public ResponseEntity<List<AccessRequestResponse>> listRequests(@AuthenticationPrincipal AppUser sbu) {
        return ResponseEntity.ok(accessRequestService.listSbuRequests(sbu));
    }

    @PostMapping("/{requestId}/accept")
    public ResponseEntity<AccessRequestResponse> accept(
            @AuthenticationPrincipal AppUser sbu,
            @PathVariable Long requestId,
            @RequestParam(defaultValue = "FULL_CONTROL") AccessLevel accessLevel
    ) {
        return ResponseEntity.ok(accessRequestService.acceptRequest(sbu, requestId, accessLevel));
    }

    @PostMapping("/{requestId}/reject")
    public ResponseEntity<AccessRequestResponse> reject(
            @AuthenticationPrincipal AppUser sbu,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(accessRequestService.rejectRequest(sbu, requestId));
    }

    @PostMapping("/{requestId}/end")
    public ResponseEntity<AccessRequestResponse> end(
            @AuthenticationPrincipal AppUser sbu,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(accessRequestService.endSbuSession(sbu, requestId));
    }
}
