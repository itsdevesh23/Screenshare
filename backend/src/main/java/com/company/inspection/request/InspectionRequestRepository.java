package com.company.inspection.request;

import com.company.inspection.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InspectionRequestRepository extends JpaRepository<InspectionRequest, Long> {

    List<InspectionRequest> findByInspectorOrderByCreatedAtDesc(AppUser inspector);

    List<InspectionRequest> findBySbuOrderByCreatedAtDesc(AppUser sbu);

    Optional<InspectionRequest> findByIdAndInspector(Long id, AppUser inspector);

    Optional<InspectionRequest> findByIdAndSbu(Long id, AppUser sbu);

    Optional<InspectionRequest> findFirstByInspectorAndSbuAndStatusInOrderByCreatedAtDesc(
            AppUser inspector,
            AppUser sbu,
            Collection<InspectionRequestStatus> statuses
    );

    Optional<InspectionRequest> findFirstBySbuAndStatusInOrderByCreatedAtDesc(
            AppUser sbu,
            Collection<InspectionRequestStatus> statuses
    );

    long countBySbuAndStatus(AppUser sbu, InspectionRequestStatus status);
}
