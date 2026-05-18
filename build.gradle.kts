plugins {
    kotlin("jvm") version "2.3.0"
    kotlin("plugin.serialization") version "2.3.0"
    application
}

group = "com.rz.gateway"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(25))
    }
}

application {
    mainClass.set("io.ktor.server.netty.EngineMain")
}

dependencies {
    implementation("io.ktor:ktor-server-core-jvm:3.4.0")
    implementation("io.ktor:ktor-server-netty-jvm:3.4.0")
    implementation("io.ktor:ktor-server-call-logging-jvm:3.4.0")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:3.4.0")
    implementation("io.ktor:ktor-server-status-pages-jvm:3.4.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:3.4.0")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")

    implementation("org.jetbrains.exposed:exposed-core:1.1.0")
    implementation("org.jetbrains.exposed:exposed-jdbc:1.1.0")
    implementation("org.jetbrains.exposed:exposed-java-time:1.1.0")
    implementation("com.zaxxer:HikariCP:7.0.2")
    implementation("org.postgresql:postgresql:42.7.8")
    implementation("org.flywaydb:flyway-core:12.6.1")
    implementation("org.flywaydb:flyway-database-postgresql:12.6.1")
    implementation("at.favre.lib:bcrypt:0.10.2")

    implementation("org.redisson:redisson:4.2.0")
    implementation("ch.qos.logback:logback-classic:1.5.21")

    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host-jvm:3.4.0")
}

tasks.test {
    useJUnitPlatform()
}
