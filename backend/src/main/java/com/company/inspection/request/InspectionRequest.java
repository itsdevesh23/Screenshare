package com.company.inspection.request;

import com.company.inspection.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "inspection_requests")
public class InspectionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inspector_id", nullable = false)
    private AppUser inspector;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sbu_id", nullable = false)
    private AppUser sbu;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InspectionRequestStatus status = InspectionRequestStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_level", length = 30)
    private AccessLevel accessLevel;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    protected InspectionRequest() {
    }

    public InspectionRequest(AppUser inspector, AppUser sbu) {
        this.inspector = inspector;
        this.sbu = sbu;
    }

    public Long getId() {
        return id;
    }

    public AppUser getInspector() {
        return inspector;
    }

    public AppUser getSbu() {
        return sbu;
    }

    public InspectionRequestStatus getStatus() {
        return status;
    }

    public AccessLevel getAccessLevel() {
        return accessLevel;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getRespondedAt() {
        return respondedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void accept(AccessLevel accessLevel) {
        this.status = InspectionRequestStatus.ACCEPTED;
        this.accessLevel = accessLevel;
        this.respondedAt = Instant.now();
    }

    public void reject() {
        status = InspectionRequestStatus.REJECTED;
        respondedAt = Instant.now();
    }

    public void end() {
        status = InspectionRequestStatus.ENDED;
        endedAt = Instant.now();
    }
}
