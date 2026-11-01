package dev.cord.preview

import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import io.livekit.android.ConnectOptions
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/** A screen-only native participant; audio/video UI remains in the shared WebView. */
@CapacitorPlugin(name = "CordScreenShare")
class ScreenSharePlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var room: Room? = null
    private var starting = false
    private var cancelled = false

    @PluginMethod
    fun start(call: PluginCall) {
        val url = call.getString("url")
        val token = call.getString("token")
        if (url == null || !(url.startsWith("ws://") || url.startsWith("wss://")) || token.isNullOrBlank()) {
            call.reject("Invalid screen-sharing connection")
            return
        }
        if (starting || room != null) { call.reject("Screen sharing is already active"); return }
        starting = true
        cancelled = false
        val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(call, manager.createScreenCaptureIntent(), "captureResult")
    }

    @ActivityCallback
    private fun captureResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) { starting = false; return }
        if (cancelled) { starting = false; call.reject("Screen capture was cancelled"); return }
        val data = result.data
        if (result.resultCode != Activity.RESULT_OK || data == null) {
            starting = false
            call.reject("Screen capture was cancelled")
            return
        }
        scope.launch {
            try {
                val connection = LiveKit.create(context.applicationContext)
                room = connection
                connection.connect(call.getString("url")!!, call.getString("token")!!, ConnectOptions(autoSubscribe = false))
                val published = connection.localParticipant.setScreenShareEnabled(true, ScreenCaptureParams(
                    mediaProjectionPermissionResultData = data,
                    onStop = { activity.runOnUiThread { releaseRoom() } }
                ))
                if (!published) throw IllegalStateException("Screen capture could not be published")
                starting = false
                notifyListeners("stateChanged", JSObject().put("active", true))
                call.resolve()
            } catch (_: Exception) {
                releaseRoom()
                call.reject("Unable to start screen capture")
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread { releaseRoom(); call.resolve() }
    }

    private fun releaseRoom() {
        val current = room
        room = null
        cancelled = true
        starting = false
        current?.disconnect()
        current?.release()
        notifyListeners("stateChanged", JSObject().put("active", false))
    }

    override fun handleOnDestroy() {
        releaseRoom()
        scope.cancel()
        super.handleOnDestroy()
    }
}
