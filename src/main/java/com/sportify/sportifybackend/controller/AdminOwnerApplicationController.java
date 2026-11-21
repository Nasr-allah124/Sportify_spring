package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.OwnerApplication;
import com.sportify.sportifybackend.entity.Role;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.OwnerApplicationRepository;
import com.sportify.sportifybackend.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/owner-applications")
public class AdminOwnerApplicationController {

    private final OwnerApplicationRepository applications;
    private final UserRepository users;

    public AdminOwnerApplicationController(
            OwnerApplicationRepository applications,
            UserRepository users
    ) {
        this.applications = applications;
        this.users = users;
    }

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
        Long adminId = Long.valueOf(jwt.getSubject());

        // Vérification du compte et du rôle actuel en base.
        users.findById(adminId)
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .filter(user -> user.getRole() == Role.ADMIN)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Accès réservé à un administrateur actif"
                ));

        return applications
                .findByStatusOrderBySubmittedAtAsc(
                        OwnerApplication.Status.PENDING
                )
                .stream()
                .map(OwnerApplicationResponse::from)
                .toList();
    }
}