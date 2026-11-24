package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.OwnerApplication;
import com.sportify.sportifybackend.entity.Role;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.OwnerApplicationRepository;
import com.sportify.sportifybackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/owner-applications")
public class AdminOwnerApplicationController {

    private final OwnerApplicationRepository applications;
    private final UserRepository users;
    private final JdbcTemplate db;

    public AdminOwnerApplicationController(
            OwnerApplicationRepository applications,
            UserRepository users,
            JdbcTemplate db
    ) {
        this.applications = applications;
        this.users = users;
        this.db = db;
    }

    public enum Decision {
        APPROVED, REJECTED
    }

    public record Review(
            Decision decision,
            String rejectionReason,
            String reason
    ) {}

    public record OwnerApplicationResponse(
            Long id,
            String applicantName,
            String applicantEmail,
            String complexName,
            String city,
            String address,
            String phone,
            String description,
            Double latitude,
            Double longitude,
            OwnerApplication.Status status,
            Instant submittedAt
    ) {
        static OwnerApplicationResponse from(OwnerApplication application) {
            User applicant = application.getApplicant();

            return new OwnerApplicationResponse(
                    application.getId(),
                    applicant.getFirstName() + " " + applicant.getLastName(),
                    applicant.getEmail(),
                    application.getComplexName(),
                    application.getCity(),
                    application.getAddress(),
                    application.getPhone(),
                    application.getDescription(),
                    application.getLatitude(),
                    application.getLongitude(),
                    application.getStatus(),
                    application.getSubmittedAt()
            );
        }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<OwnerApplicationResponse> pendingApplications(
            @AuthenticationPrincipal Jwt jwt
    ) {
        requireAdmin(jwt);

        return applications.findByStatusOrderBySubmittedAtAsc(
                        OwnerApplication.Status.PENDING
                )
                .stream()
                .map(OwnerApplicationResponse::from)
                .toList();
    }

    @PatchMapping("/{id}/decision")
    @Transactional
    public OwnerApplicationResponse review(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id,
            @RequestBody Review request
    ) {
        User reviewer = requireAdmin(jwt);

        if (request.decision() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Décision obligatoire"
            );
        }

        List<Long> applicants = db.queryForList("""
                select applicant_id
                from owner_applications
                where id = ? and status = 'PENDING'
                for update
                """, Long.class, id);

        if (applicants.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Demande introuvable ou déjà traitée"
            );
        }

        Long complexId = null;
        String reason = null;

        if (request.decision() == Decision.APPROVED) {
            complexId = approve(id, applicants.getFirst());
        } else {
            reason = request.rejectionReason() != null
                    ? request.rejectionReason()
                    : request.reason();

            if (reason == null || reason.isBlank() || reason.strip().length() > 1000) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Indiquez un motif de refus de 1 à 1000 caractères"
                );
            }

            reason = reason.strip();
        }

        db.update("""
                update owner_applications
                set status = ?, reviewed_by = ?, reviewed_at = current_timestamp,
                    rejection_reason = ?, created_complex_id = ?
                where id = ?
                """,
                request.decision().name(),
                reviewer.getId(),
                reason,
                complexId,
                id
        );

        return OwnerApplicationResponse.from(
                applications.findById(id).orElseThrow()
        );
    }

    private Long approve(long applicationId, long applicantId) {
        int updated = db.update("""
                update users
                set role = 'OWNER'
                where id = ?
                  and role in ('CLIENT', 'OWNER')
                  and enabled
                  and email_verified
                """, applicantId);

        if (updated != 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Compte non éligible"
            );
        }

        List<Long> existing = db.queryForList("""
                select id from sport_complexes where owner_id = ?
                """, Long.class, applicantId);

        if (!existing.isEmpty()) {
            long complexId = existing.getFirst();

            Boolean alreadyLinked = db.queryForObject("""
                    select exists (
                        select 1 from owner_applications
                        where created_complex_id = ? and id <> ?
                    )
                    """, Boolean.class, complexId, applicationId);

            if (Boolean.TRUE.equals(alreadyLinked)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Ce propriétaire possède déjà un complexe rattaché à une demande"
                );
            }

            return complexId;
        }

        return db.queryForObject("""
                insert into sport_complexes (
                    owner_id, name, city, address, phone, description,
                    latitude, longitude, status, created_at
                )
                select applicant_id, complex_name, city, address, phone,
                       description, latitude, longitude, 'PENDING', current_timestamp
                from owner_applications
                where id = ?
                returning id
                """, Long.class, applicationId);
    }

    private User requireAdmin(Jwt jwt) {
        return users.findById(Long.valueOf(jwt.getSubject()))
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .filter(user -> user.getRole() == Role.ADMIN)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "Accès administrateur requis"
                ));
    }
}