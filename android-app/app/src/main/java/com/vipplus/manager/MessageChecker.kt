package com.vipplus.manager

import android.content.Context
import android.telephony.SmsManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive

/**
 * 주기적으로 서버를 체크하여 대기중인 작업 처리
 */
object MessageChecker {
    
    private const val TAG = "VipManager"
    private const val CHECK_INTERVAL = 10000L // 10초마다 체크
    
    private var isRunning = false
    
    /**
     * 체크 시작
     */
    fun start(context: Context) {
        if (isRunning) {
            Log.d(TAG, "이미 실행 중입니다")
            return
        }
        
        isRunning = true
        Log.d(TAG, "메시지 체커 시작")
        
        CoroutineScope(Dispatchers.IO).launch {
            while (isActive && isRunning) {
                try {
                    checkAndProcessPending(context)
                } catch (e: Exception) {
                    Log.e(TAG, "체크 오류: ${e.message}", e)
                }
                
                delay(CHECK_INTERVAL)
            }
        }
    }
    
    /**
     * 체크 중지
     */
    fun stop() {
        isRunning = false
        Log.d(TAG, "메시지 체커 중지")
    }
    
    /**
     * 대기중인 작업 처리
     */
    private suspend fun checkAndProcessPending(context: Context) {
        val prefs = context.getSharedPreferences("VIP_MANAGER", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("SERVER_URL", "") ?: ""
        val devicePhoneNumber = prefs.getString("PHONE_NUMBER", "") ?: ""
        
        if (serverUrl.isEmpty() || devicePhoneNumber.isEmpty()) {
            return
        }
        
        try {
            // 1. 대기중인 전달 처리
            val pendingForwards = ApiClient.getPendingForwards(serverUrl)
            
            if (pendingForwards.isNotEmpty()) {
                Log.d(TAG, "대기중인 전달: ${pendingForwards.size}개")
                
                for (forward in pendingForwards) {
                    try {
                        processForward(context, forward, serverUrl)
                    } catch (e: Exception) {
                        Log.e(TAG, "전달 오류 (ID: ${forward.id}): ${e.message}", e)
                    }
                }
            }
            
            // 2. 대기중인 자동응답 처리
            val pendingReplies = ApiClient.getPendingAutoReplies(serverUrl, devicePhoneNumber)
            
            if (pendingReplies.isNotEmpty()) {
                Log.d(TAG, "대기중인 자동응답: ${pendingReplies.size}개")
                
                for (reply in pendingReplies) {
                    try {
                        sendAutoReply(context, reply, serverUrl)
                    } catch (e: Exception) {
                        Log.e(TAG, "자동응답 오류 (ID: ${reply.id}): ${e.message}", e)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "대기 작업 조회 오류: ${e.message}", e)
        }
    }
    
    /**
     * 전달 실행
     */
    private fun processForward(context: Context, forward: PendingForwardData, serverUrl: String) {
        val targetNumbers = forward.targetNumbers.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        
        if (targetNumbers.isEmpty()) {
            Log.w(TAG, "전달 대상 번호가 없습니다 (ID: ${forward.id})")
            return
        }
        
        Log.d(TAG, "전달 시작 (ID: ${forward.id}, 대상: ${targetNumbers.size}개)")
        
        val smsManager = SmsManager.getDefault()
        val results = mutableListOf<ForwardResult>()
        
        for (targetNumber in targetNumbers) {
            try {
                // 메시지 전송
                smsManager.sendTextMessage(
                    targetNumber,
                    null,
                    forward.message,
                    null,
                    null
                )
                
                results.add(ForwardResult(targetNumber, true, null))
                Log.d(TAG, "✅ 전송 성공: $targetNumber")
                
                // 전송 간격
                Thread.sleep(200)
                
            } catch (e: Exception) {
                results.add(ForwardResult(targetNumber, false, e.message))
                Log.e(TAG, "❌ 전송 실패: $targetNumber")
            }
        }
        
        // 서버에 완료 알림
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ApiClient.updateForwardStatus(serverUrl, forward.id, results)
                Log.d(TAG, "상태 업데이트 완료 (ID: ${forward.id})")
            } catch (e: Exception) {
                Log.e(TAG, "상태 업데이트 실패: ${e.message}", e)
            }
        }
    }
    
    /**
     * 자동응답 전송 실행
     */
    private fun sendAutoReply(context: Context, reply: PendingAutoReplyData, serverUrl: String) {
        Log.d(TAG, "자동응답 전송 시작 (ID: ${reply.id})")
        
        val smsManager = SmsManager.getDefault()
        var success = false
        var errorMessage: String? = null
        
        try {
            // 자동응답 전송
            smsManager.sendTextMessage(
                reply.sender,
                null,
                reply.reply,
                null,
                null
            )
            
            success = true
            Log.d(TAG, "✅ 자동응답 전송 성공")
            
        } catch (e: Exception) {
            errorMessage = e.message
            Log.e(TAG, "❌ 자동응답 전송 실패")
        }
        
        // 서버에 완료 알림
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ApiClient.updateAutoReplyStatus(serverUrl, reply.id, success, errorMessage)
                Log.d(TAG, "자동응답 상태 업데이트 완료")
            } catch (e: Exception) {
                Log.e(TAG, "자동응답 상태 업데이트 실패", e)
            }
        }
    }
}

/**
 * 대기중인 전달 데이터
 */
data class PendingForwardData(
    val id: String,
    val message: String,
    val targetNumbers: String
)

/**
 * 대기중인 자동응답 데이터
 */
data class PendingAutoReplyData(
    val id: String,
    val sender: String,
    val reply: String
)

/**
 * 전달 결과
 */
data class ForwardResult(
    val targetNumber: String,
    val success: Boolean,
    val errorMessage: String?
)


