package com.fleetfeast.mobile.shared

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class JvmJsonFileOfflineActionStore(
  private val filePath: Path,
  private val json: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  },
) : OfflineActionStore {
  private val lock = Any()

  override fun loadAll(): List<OfflineAction> {
    synchronized(lock) {
      if (!Files.exists(filePath)) {
        return emptyList()
      }

      val raw = Files.readString(filePath)
      if (raw.isBlank()) {
        return emptyList()
      }

      return try {
        json.decodeFromString<List<OfflineAction>>(raw)
      } catch (_: Throwable) {
        emptyList()
      }
    }
  }

  override fun saveAll(actions: List<OfflineAction>) {
    synchronized(lock) {
      val parent = filePath.parent
      if (parent != null) {
        Files.createDirectories(parent)
      }

      val encoded = json.encodeToString(actions)
      Files.writeString(
        filePath,
        encoded,
        StandardOpenOption.CREATE,
        StandardOpenOption.TRUNCATE_EXISTING,
        StandardOpenOption.WRITE,
      )
    }
  }
}
