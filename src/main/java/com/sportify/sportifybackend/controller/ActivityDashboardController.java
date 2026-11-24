package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.Role;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.UserRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class ActivityDashboardController {

    private static final ZoneId ZONE = ZoneId.of("Africa/Casablanca");
    private static final int PAGE_SIZE = 20;

    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository users;

    public ActivityDashboardController(
            NamedParameterJdbcTemplate jdbc,
            UserRepository users
    ) {
        this.jdbc = jdbc;
        this.users = users;
    }

    public record DayRow(LocalDate day, long confirmed, long cancelled) {}

    public record ComplexRow(
            long id, String name, String city, String owner,
            long fields, long confirmed, long cancelled
    ) {}

    public record BookingRow(
            long id, String client, String complex, String field,
            Instant createdAt, Instant startAt, Instant endAt, String status
    ) {}

    public record Activity(
            LocalDate from, LocalDate through, List<DayRow> days,
            List<ComplexRow> complexes, List<BookingRow> bookings,
            int page, boolean hasNext
    ) {}

    @GetMapping("/admin/activity")
    public ResponseEntity<Activity> admin(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "0") int page
    ) {
        requireRole(jwt, "ADMIN");
        return response(readActivity(null, days, page));
    }

    @GetMapping("/owner/activity")
    public ResponseEntity<Activity> owner(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "0") int page
    ) {
        User owner = requireRole(jwt, "OWNER");
        return response(readActivity(owner.getId(), days, page));
    }

    private User requireRole(Jwt jwt, String role) {
        if (jwt == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        return users.findById(Long.valueOf(jwt.getSubject()))
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .filter(user -> user.getRole().name().equals(role))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
    }

    private ResponseEntity<Activity> response(Activity activity) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(activity);
    }

    private Activity readActivity(Long ownerId, int days, int page) {
        if ((days != 7 && days != 30) || page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }

        LocalDate from = LocalDate.now(ZONE);
        LocalDate until = from.plusDays(days);

        var params = new MapSqlParameterSource()
                .addValue("fromDate", java.sql.Date.valueOf(from))
                .addValue("dayCount", days)
                .addValue("start", Timestamp.from(from.atStartOfDay(ZONE).toInstant()))
                .addValue("end", Timestamp.from(until.atStartOfDay(ZONE).toInstant()))
                .addValue("zone", ZONE.getId())
                .addValue("offset", (long) page * PAGE_SIZE)
                .addValue("limit", PAGE_SIZE + 1);

        // Ce fragment dépend exclusivement de la route et du compte côté serveur.
        String scope = "";
        if (ownerId != null) {
            params.addValue("owner", ownerId);
            scope = " AND c.owner_id = :owner ";
        }

        String bookingSource = """
                FROM reservations r
                JOIN fields f ON f.id = r.field_id
                JOIN sport_complexes c ON c.id = f.complex_id
                WHERE r.start_at >= :start AND r.start_at < :end
                """ + scope;

        List<DayRow> daily = jdbc.query("""
                WITH activity AS (
                    SELECT CAST(timezone(:zone, CAST(r.start_at AS timestamptz)) AS date) AS day,
                           count(*) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed,
                           count(*) FILTER (WHERE r.status = 'CANCELLED') AS cancelled
                """ + bookingSource + """
                    GROUP BY 1
                )
                SELECT d.day, coalesce(a.confirmed, 0) AS confirmed,
                       coalesce(a.cancelled, 0) AS cancelled
                FROM (
                    SELECT CAST(:fromDate AS date) + n AS day
                    FROM generate_series(0, CAST(:dayCount AS int) - 1) AS series(n)
                ) d
                LEFT JOIN activity a ON a.day = d.day
                ORDER BY d.day
                """, params, (rs, n) -> new DayRow(
                rs.getDate("day").toLocalDate(),
                rs.getLong("confirmed"), rs.getLong("cancelled")
        ));

        List<ComplexRow> complexes = jdbc.query("""
                SELECT c.id, c.name, c.city,
                       concat_ws(' ', u.first_name, u.last_name) AS owner_name,
                       count(DISTINCT f.id) AS fields,
                       count(r.id) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed,
                       count(r.id) FILTER (WHERE r.status = 'CANCELLED') AS cancelled
                FROM sport_complexes c
                JOIN users u ON u.id = c.owner_id
                LEFT JOIN fields f ON f.complex_id = c.id
                LEFT JOIN reservations r ON r.field_id = f.id
                    AND r.start_at >= :start AND r.start_at < :end
                WHERE true
                """ + scope + """
                GROUP BY c.id, c.name, c.city, u.first_name, u.last_name
                ORDER BY confirmed DESC, c.name, c.id
                """, params, (rs, n) -> new ComplexRow(
                rs.getLong("id"), rs.getString("name"), rs.getString("city"),
                rs.getString("owner_name"), rs.getLong("fields"),
                rs.getLong("confirmed"), rs.getLong("cancelled")
        ));

        List<BookingRow> rows = jdbc.query("""
                SELECT r.id, r.created_at, r.start_at, r.end_at, r.status,
                       f.name AS field_name, c.name AS complex_name,
                       concat_ws(' ', client.first_name, client.last_name) AS client_name
                FROM reservations r
                JOIN users client ON client.id = r.client_id
                JOIN fields f ON f.id = r.field_id
                JOIN sport_complexes c ON c.id = f.complex_id
                WHERE r.start_at >= :start AND r.start_at < :end
                """ + scope + """
                ORDER BY r.start_at, r.id
                LIMIT :limit OFFSET :offset
                """, params, (rs, n) -> new BookingRow(
                rs.getLong("id"), rs.getString("client_name"),
                rs.getString("complex_name"), rs.getString("field_name"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("start_at").toInstant(),
                rs.getTimestamp("end_at").toInstant(), rs.getString("status")
        ));

        boolean hasNext = rows.size() > PAGE_SIZE;

        return new Activity(
                from, until.minusDays(1), daily, complexes,
                hasNext ? rows.subList(0, PAGE_SIZE) : rows,
                page, hasNext
        );
    }
}