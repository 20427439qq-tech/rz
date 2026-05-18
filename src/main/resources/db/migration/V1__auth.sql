create table if not exists users (
    id serial primary key,
    username varchar(64) not null,
    password_hash varchar(255) not null,
    display_name varchar(100) not null,
    role varchar(32) not null default 'user',
    enabled boolean not null default true,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists users_username_uidx on users (username);

create table if not exists sessions (
    id bigserial primary key,
    user_id integer not null references users (id) on delete cascade,
    token_hash char(64) not null,
    expires_at timestamp not null,
    created_at timestamp not null default now(),
    last_seen_at timestamp not null default now(),
    revoked_at timestamp null,
    user_agent varchar(500) null,
    ip varchar(64) null
);

create unique index if not exists sessions_token_hash_uidx on sessions (token_hash);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);
