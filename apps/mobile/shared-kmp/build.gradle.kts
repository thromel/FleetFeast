plugins {
  kotlin("multiplatform") version "2.0.21"
  kotlin("plugin.serialization") version "2.0.21"
}

kotlin {
  jvmToolchain(17)
  jvm()

  sourceSets {
    val commonMain by getting {
      dependencies {
        implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
      }
    }
    val commonTest by getting {
      dependencies {
        implementation(kotlin("test"))
      }
    }
  }
}
