package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.dto.request.LoginRequest;
import com.sportify.sportifybackend.dto.response.LoginResponse;
import com.sportify.sportifybackend.dto.response.ProfileResponse;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.UserRepository;
import com.sportify.sportifybackend.service.LoginService;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.sportify.sportifybackend.service.GoogleIdentityVerifier;
import jakarta.validation.constraints.NotBlank;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtException;

@RestController
@RequestMapping("/api/v1")
public class LoginController {

    private final LoginService loginService;
    private final UserRepository users;

    private final GoogleIdentityVerifier googleVerifier;

    public LoginController(
            LoginService loginService,
            UserRepository users,
            GoogleIdentityVerifier googleVerifier
    ) {
        this.loginService = loginService;
        this.users = users;
        this.googleVerifier = googleVerifier;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(loginService.login(request));
    }

    public record LoginError(String code, Long userId) {}

    @ExceptionHandler(LoginService.LoginRejected.class)
    public ResponseEntity<LoginError> handleLoginRejected(LoginService.LoginRejected error) {
        HttpStatus status = switch (error.getFailure()) {
            case INVALID_CREDENTIALS -> HttpStatus.UNAUTHORIZED;
            case ACCOUNT_ALREADY_EXISTS -> HttpStatus.CONFLICT;
            default -> HttpStatus.FORBIDDEN;
        };

        return ResponseEntity.status(status)
                .cacheControl(CacheControl.noStore())
                .body(new LoginError(error.getFailure().name(), error.getUserId()));
    }

    @GetMapping("/users/me")
    public ResponseEntity<ProfileResponse> me(@AuthenticationPrincipal Jwt jwt) {
        Long userId = Long.valueOf(jwt.getSubject());

        User user = users.findById(userId)
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(ProfileResponse.from(user));
    }
    public record GoogleLoginRequest(@NotBlank String credential) {}

    @PostMapping("/auth/google")
    public ResponseEntity<?> googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
        GoogleIdentityVerifier.Identity identity;

        try {
            identity = googleVerifier.verify(request.credential());
        } catch (BadJwtException exception) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new LoginError("INVALID_GOOGLE_TOKEN", null));
        } catch (JwtException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new LoginError("GOOGLE_VERIFICATION_UNAVAILABLE", null));
        }

        try {
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(loginService.loginWithGoogle(identity));
        } catch (DataIntegrityViolationException exception) {
            // Deux premières connexions simultanées peuvent créer le même compte.
            // L’appel précédent a fini sa transaction avant cette nouvelle lecture.
            if (users.findByGoogleSubject(identity.subject()).isPresent()) {
                return ResponseEntity.ok()
                        .cacheControl(CacheControl.noStore())
                        .body(loginService.loginWithGoogle(identity));
            }
            if (users.existsByEmail(identity.email())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new LoginError("ACCOUNT_ALREADY_EXISTS", null));
            }
            throw exception;
        }
    }
}