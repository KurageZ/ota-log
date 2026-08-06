import Database from 'better-sqlite3';

/**
 * Keeps historical repository fixtures compact while their production queries exercise activity v2.
 * New activity-specific tests should insert directly into events and event_sessions instead.
 */
export function installLegacyEventFixture(db: Database.Database): void {
  db.exec(`
    CREATE VIEW fixture_events AS
    SELECT
      id, title, event_type, event_date, event_time, city, venue, ticket_price,
      status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at
    FROM event_summaries;

    CREATE TRIGGER fixture_events_insert
    INSTEAD OF INSERT ON fixture_events
    BEGIN
      INSERT INTO events
        (id, title, event_type, status, review_score, notes, details, url,
         setlist_text, actual_expense, trip_id, created_at, updated_at)
      VALUES
        (NEW.id, NEW.title, NEW.event_type, NEW.status, NEW.review_score,
         NEW.notes, NEW.details, NEW.url, NEW.setlist_text, NEW.ticket_price,
         NEW.trip_id, NEW.created_at, NEW.updated_at);

      INSERT INTO event_sessions
        (id, event_id, title, session_date, end_date, open_time, start_time,
         end_time, city, venue, sort_order, created_at, updated_at)
      VALUES
        ('fixture-session-' || NEW.id, NEW.id, NULL, NEW.event_date, NULL, NULL,
         NEW.event_time, NULL, NEW.city, NEW.venue, 0, NEW.created_at, NEW.updated_at);
    END;
  `);
}
