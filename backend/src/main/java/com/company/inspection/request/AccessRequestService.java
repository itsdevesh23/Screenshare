package com.company.inspection.request;

import com.company.inspection.user.AppUser;
import com.company.inspection.user.UserRepository;
import com.company.inspection.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class AccessRequestService {

    private static final List<InspectionRequestStatus> ACTIVE_STATUSES = List.of(
            InspectionRequestStatus.PENDING,
            InspectionRequestStatus.ACCEPTED
    );

    private final UserRepository userRepository;
    private final InspectionRequestRepository requestRepository;

    public AccessRequestService(UserRepository userRepository, InspectionRequestRepository requestRepository) {
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
    }

    @Transactional(readOnly = true)
    public List<SbuStationResponse> listSbuStations() {
        return userRepository.findByRoleOrderByUsernameAsc(UserRole.SBU).stream()
                .map(sbu -> new SbuStationResponse(
                        sbu.getId(),
                        sbu.getUsername(),
                        requestRepository.countBySbuAndStatus(sbu, InspectionRequestStatus.PENDING) > 0,
                        requestRepository.countBySbuAndStatus(sbu, InspectionRequestStatus.ACCEPTED) > 0
                ))
                .toList();
    }

    @Transactional
    public AccessRequestResponse createRequest(AppUser inspector, AccessRequestCreateRequest request) {
        AppUser sbu = userRepository.findById(request.sbuUserId())
                .filter(user -> user.getRole() == UserRole.SBU)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SBU user not found"));

        requestRepository.findFirstByInspectorAndSbuAndStatusInOrderByCreatedAtDesc(inspector, sbu, ACTIVE_STATUSES)
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have an active request for this SBU");
                });

        InspectionRequest saved = requestRepository.save(new InspectionRequest(inspector, sbu));
        return AccessRequestResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<AccessRequestResponse> listInspectorRequests(AppUser inspector) {
        return requestRepository.findByInspectorOrderByCreatedAtDesc(inspector).stream()
                .map(AccessRequestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AccessRequestResponse> listSbuRequests(AppUser sbu) {
        return requestRepository.findBySbuOrderByCreatedAtDesc(sbu).stream()
                .map(AccessRequestResponse::from)
                .toList();
    }

    @Transactional
    public AccessRequestResponse acceptRequest(AppUser sbu, Long requestId) {
        InspectionRequest request = getPendingRequestForSbu(sbu, requestId);

        requestRepository.findFirstBySbuAndStatusInOrderByCreatedAtDesc(sbu, List.of(InspectionRequestStatus.ACCEPTED))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "An accepted session is already active");
                });

        request.accept();
        return AccessRequestResponse.from(request);
    }

    @Transactional
    public AccessRequestResponse rejectRequest(AppUser sbu, Long requestId) {
        InspectionRequest request = getPendingRequestForSbu(sbu, requestId);
        request.reject();
        return AccessRequestResponse.from(request);
    }

    @Transactional
    public AccessRequestResponse endInspectorSession(AppUser inspector, Long requestId) {
        InspectionRequest request = requestRepository.findByIdAndInspector(requestId, inspector)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        return endAcceptedSession(request);
    }

    @Transactional
    public AccessRequestResponse endSbuSession(AppUser sbu, Long requestId) {
        InspectionRequest request = requestRepository.findByIdAndSbu(requestId, sbu)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        return endAcceptedSession(request);
    }

    @Transactional(readOnly = true)
    public AccessRequestResponse getAcceptedRequest(Long requestId) {
        InspectionRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (request.getStatus() != InspectionRequestStatus.ACCEPTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request is not accepted");
        }

        return AccessRequestResponse.from(request);
    }

    private InspectionRequest getPendingRequestForSbu(AppUser sbu, Long requestId) {
        InspectionRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (!request.getSbu().getId().equals(sbu.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Request belongs to another SBU");
        }

        if (request.getStatus() != InspectionRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request is no longer pending");
        }

        return request;
    }

    private AccessRequestResponse endAcceptedSession(InspectionRequest request) {
        if (request.getStatus() != InspectionRequestStatus.ACCEPTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only accepted sessions can be ended");
        }

        request.end();
        return AccessRequestResponse.from(request);
    }
}
