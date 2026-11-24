package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.Role;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.UserRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminDashboardController {

    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public AdminDashboardController(JdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    public record Totals(
            long accounts,
            long clients,
            long owners,
            long complexes,
            long fields,
            long confirmed,
            long cancelled,
            long pending
    ) {}

    public record OwnerRow(
            long id,
            String name,
            long complexes,
            long fields,
            String complexesBySport,
            long confirmed,
            long cancelled
    ) {}

    public record AccountRow(
            long id,
            String name,
            String email,
            String role,
            long bookings
    ) {}

    public record Dashboard(
            Totals totals,
            List<OwnerRow> owners,
            List<AccountRow> accounts
    ) {}

    @GetMapping("/dashboard")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResponseEntity<Dashboard> dashboard(@AuthenticationPrincipal Jwt jwt) {
        users.findById(Long.valueOf(jwt.getSubject()))
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .filter(user -> user.getRole() == Role.ADMIN)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "Accès réservé aux administrateurs."
                ));

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new Dashboard(readTotals(), readOwners(), readAccounts()));
    }

    private Totals readTotals() {
        return jdbc.queryForObject("""
                SELECT count(*) AS accounts,
                       count(*) FILTER (WHERE role = 'CLIENT') AS clients,
                       count(*) FILTER (WHERE role = 'OWNER') AS owners,
                       (SELECT count(*) FROM sport_complexes) AS complexes,
                       (SELECT count(*) FROM fields) AS fields,
                       (SELECT count(*) FROM reservations
                         WHERE status = 'CONFIRMED') AS confirmed,
                       (SELECT count(*) FROM reservations
                         WHERE status = 'CANCELLED') AS cancelled,
                       (SELECT count(*) FROM owner_applications
                         WHERE status = 'PENDING') AS pending
                FROM users
                """, (rs, row) -> new Totals(
                rs.getLong("accounts"), rs.getLong("clients"),
                rs.getLong("owners"), rs.getLong("complexes"),
                rs.getLong("fields"), rs.getLong("confirmed"),
                rs.getLong("cancelled"), rs.getLong("pending")
        ));
    }

    private List<OwnerRow> readOwners() {
        return jdbc.query("""
                WITH sport_counts AS (
                    SELECT c.owner_id, f.sport_type,
                           count(DISTINCT c.id) AS complex_count
                    FROM sport_complexes c
                    JOIN fields f ON f.complex_id = c.id
                    GROUP BY c.owner_id, f.sport_type
                ),
                sports AS (
                    SELECT owner_id,
                           string_agg(
                               initcap(lower(sport_type)) || ' : ' || complex_count,
                               ' · ' ORDER BY sport_type
                           ) AS breakdown
                    FROM sport_counts
                    GROUP BY owner_id
                )
                SELECT u.id,
                       concat_ws(' ', u.first_name, u.last_name) AS name,
                       count(DISTINCT c.id) AS complexes,
                       count(DISTINCT f.id) AS fields,
                       coalesce(s.breakdown, '') AS breakdown,
                       count(r.id) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed,
                       count(r.id) FILTER (WHERE r.status = 'CANCELLED') AS cancelled
                FROM users u
                LEFT JOIN sport_complexes c ON c.owner_id = u.id
                LEFT JOIN fields f ON f.complex_id = c.id
                LEFT JOIN reservations r ON r.field_id = f.id
                LEFT JOIN sports s ON s.owner_id = u.id
                WHERE u.role = 'OWNER'
                GROUP BY u.id, u.first_name, u.last_name, s.breakdown
                ORDER BY confirmed DESC, name, u.id
                """, (rs, row) -> new OwnerRow(
                rs.getLong("id"), rs.getString("name"),
                rs.getLong("complexes"), rs.getLong("fields"),
                rs.getString("breakdown"),
                rs.getLong("confirmed"), rs.getLong("cancelled")
        ));
    }

    private List<AccountRow> readAccounts() {
        return jdbc.query("""
                SELECT u.id, concat_ws(' ', u.first_name, u.last_name) AS name,
                       u.email, u.role, count(r.id) AS bookings
                FROM users u
                LEFT JOIN reservations r ON r.client_id = u.id
                GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
                ORDER BY u.created_at DESC, u.id DESC
                """, (rs, row) -> new AccountRow(
                rs.getLong("id"), rs.getString("name"),
                rs.getString("email"), rs.getString("role"),
                rs.getLong("bookings")
        ));
    }
}