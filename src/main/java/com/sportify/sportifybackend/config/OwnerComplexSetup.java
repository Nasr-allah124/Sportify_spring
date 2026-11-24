package com.sportify.sportifybackend.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class OwnerComplexSetup implements ApplicationRunner {

    private final JdbcTemplate db;

    public OwnerComplexSetup(JdbcTemplate db) {
        this.db = db;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        db.execute("""
                lock table owner_applications, sport_complexes
                in share row exclusive mode
                """);

        List<Long> duplicateOwners = db.queryForList("""
                select owner_id
                from sport_complexes
                group by owner_id
                having count(*) > 1
                """, Long.class);

        if (!duplicateOwners.isEmpty()) {
            throw new IllegalStateException(
                    "Plusieurs complexes existent pour les propriétaires "
                            + duplicateOwners
                            + ". Vérifiez leurs terrains avant de choisir le complexe à conserver."
            );
        }

        List<Long> ambiguousApplications = db.queryForList("""
                select applicant_id
                from owner_applications
                where status = 'APPROVED'
                group by applicant_id
                having count(*) > 1 and bool_or(created_complex_id is null)
                """, Long.class);

        if (!ambiguousApplications.isEmpty()) {
            throw new IllegalStateException(
                    "Plusieurs demandes approuvées nécessitent une vérification pour "
                            + ambiguousApplications
            );
        }

        db.execute("""
                create unique index if not exists uq_sportify_single_owner
                on sport_complexes(owner_id)
                """);

        db.update("""
                insert into sport_complexes (
                    owner_id, name, city, address, phone, description,
                    latitude, longitude, status, created_at
                )
                select a.applicant_id, a.complex_name, a.city, a.address,
                       a.phone, a.description, a.latitude, a.longitude,
                       'PENDING', current_timestamp
                from owner_applications a
                join users u on u.id = a.applicant_id
                where a.status = 'APPROVED'
                  and u.role = 'OWNER'
                  and a.created_complex_id is null
                  and not exists (
                      select 1 from sport_complexes c
                      where c.owner_id = a.applicant_id
                  )
                """);

        db.update("""
                update owner_applications a
                set created_complex_id = c.id
                from sport_complexes c
                where a.status = 'APPROVED'
                  and a.created_complex_id is null
                  and c.owner_id = a.applicant_id
                """);
    }
}