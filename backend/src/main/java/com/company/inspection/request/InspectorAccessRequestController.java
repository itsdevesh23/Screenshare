package com.company.inspection.request;

import com.company.inspection.user.AppUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/inspector")
public class InspectorAccessRequestController {

    private final AccessRequestService accessRequestService;

    public InspectorAccessRequestController(AccessRequestService accessRequestService) {
        this.accessRequestService = accessRequestService;
    }

    @GetMapping("/sbus")
    public ResponseEntity<List<SbuStationResponse>> listSbus() {
        return ResponseEntity.ok(accessRequestService.listSbuStations());
    }

    @GetMapping("/access-requests")
    public ResponseEntity<List<AccessRequestResponse>> listRequests(@AuthenticationPrincipal AppUser inspector) {
        return ResponseEntity.ok(accessRequestService.listInspectorRequests(inspector));
    }

    @PostMapping("/access-requests")
    public ResponseEntity<AccessRequestResponse> createRequest(
            @AuthenticationPrincipal AppUser inspector,
            @Valid @RequestBody AccessRequestCreateRequest request
    ) {
        return ResponseEntity.ok(accessRequestService.createRequest(inspector, request));
    }

    @PostMapping("/access-requests/{requestId}/end")
    public ResponseEntity<AccessRequestResponse> endRequest(
            @AuthenticationPrincipal AppUser inspector,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(accessRequestService.endInspectorSession(inspector, requestId));
    }
}
