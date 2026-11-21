package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.OwnerApplication;
import com.sportify.sportifybackend.entity.Role;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.OwnerApplicationRepository;
import com.sportify.sportifybackend.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/owner-applications")
public class OwnerApplicationController {

    private final OwnerApplicationRepository applications;
    private final UserRepository users;

    public OwnerApplicationController(
            OwnerApplicationRepository applications,
            UserRepository users
    ) {
        this.applications = applications;
        this.users = users;
    }

    public record CreateRequest(
            @NotBlank @Size(max = 150) String complexName,
            @NotBlank @Size(max = 100) String city,
            @NotBlank @Size(max = 255) String address,
            @NotBlank @Size(max = 30) String phone,
            @Size(max = 2000) String description,

            @NotNull @DecimalMin("-90") @DecimalMax("90")
            BigDecimal latitude,

            @NotNull @DecimalMin("-180") @DecimalMax("180")
            BigDecimal longitude
    ) {}

    public record ApplicationResponse(
            Long id,
            String complexName,
            OwnerApplication.Status status,
            Instant submittedAt,
            String rejectionReason,
            Double latitude,
            Double longitude
    ) {
        static ApplicationResponse from(OwnerApplication application) {
            return new ApplicationResponse(
                    application.getId(),
                    application.getComplexName(),
                    application.getStatus(),
                    application.getSubmittedAt(),
                    application.getRejectionReason(),
                    application.getLatitude(),
                    application.getLongitude()
            );
        }
    }

    @GetMapping("/me/latest")
    @Transactional(readOnly = true)
    public ResponseEntity<ApplicationResponse> latest(@AuthenticationPrincipal Jwt jwt) {
        Long userId = Long.valueOf(jwt.getSubject());

        boolean activeAccount = users.findById(userId)
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .isPresent();

        if (!activeAccount) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return applications.findFirstByApplicant_IdOrderByIdDesc(userId)
                .map(application -> ResponseEntity.ok(ApplicationResponse.from(application)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ApplicationResponse> submit(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateRequest request
    ) {
        Long userId = Long.valueOf(jwt.getSubject());

        User user = users.findForOwnerApplication(userId)
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (user.getRole() != Role.CLIENT) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        var latest = applications.findFirstByApplicant_IdOrderByIdDesc(userId);
        if (latest.isPresent() && latest.get().getStatus() != OwnerApplication.Status.REJECTED) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApplicationResponse.from(latest.get()));
        }
        var application = new OwnerApplication(
                user,
                request.complexName(),
                request.city(),
                request.address(),
                request.phone(),
                request.description(),
                request.latitude().doubleValue(),
                request.longitude().doubleValue()
        );

        var saved = applications.save(application);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApplicationResponse.from(saved));
    }
}