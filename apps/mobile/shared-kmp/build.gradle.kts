plugins {
  kotlin("multiplatform") version "2.0.21"
}

kotlin {
  jvmToolchain(17)
  jvm()

  sourceSets {
    val commonMain by getting
    val commonTest by getting {
      dependencies {
        implementation(kotlin("test"))
      }
    }
  }
}
