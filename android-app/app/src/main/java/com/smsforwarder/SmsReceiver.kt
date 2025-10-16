package com.smsforwarder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.telephony.SmsMessage
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class SmsReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "SmsReceiver"
    }
    
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        
        if (intent.action == "android.provider.Telephony.SMS_RECEIVED") {
            val bundle: Bundle? = intent.extras
            
            try {
                if (bundle != null) {
                    val pdus = bundle.get("pdus") as Array<*>
                    
                    for (pdu in pdus) {
                        val format = bundle.getString("format")
                        val smsMessage = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            SmsMessage.createFromPdu(pdu as ByteArray, format)
                        } else {
                            @Suppress("DEPRECATION")
                            SmsMessage.createFromPdu(pdu as ByteArray)
                        }
                        
                        val sender = smsMessage.originatingAddress ?: ""
                        val message = smsMessage.messageBody ?: ""
                        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                            .format(Date(smsMessage.timestampMillis))
                        
                        Log.d(TAG, "SMS 수신: 발신=$sender, 메시지=$message")
                        
                        // SharedPreferences에 마지막 SMS 저장
                        val prefs = context.getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("LAST_SMS", "발신: $sender\n메시지: ${message.take(50)}...")
                            .putString("LAST_SMS_TIME", timestamp)
                            .apply()
                        
                        // 수신번호 가져오기 (현재 폰 번호)
                        val receiver = getPhoneNumber(context)
                        
                        // 서버로 전송
                        sendSmsToServer(context, sender, receiver, message, timestamp)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "SMS 처리 오류: ${e.message}", e)
            }
        }
    }
    
    private fun getPhoneNumber(context: Context): String {
        // 실제로는 TelephonyManager로 가져올 수 있지만, 
        // 간단하게 SharedPreferences에서 가져오거나 기본값 사용
        val prefs = context.getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
        return prefs.getString("PHONE_NUMBER", "UNKNOWN") ?: "UNKNOWN"
    }
    
    private fun sendSmsToServer(
        context: Context,
        sender: String,
        receiver: String,
        message: String,
        timestamp: String
    ) {
        val prefs = context.getSharedPreferences("SMS_FORWARDER", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("SERVER_URL", "") ?: ""
        
        if (serverUrl.isEmpty()) {
            Log.w(TAG, "서버 URL이 설정되지 않았습니다")
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val smsData = mapOf(
                    "sender" to sender,
                    "receiver" to receiver,
                    "message" to message,
                    "timestamp" to timestamp
                )
                
                val success = ApiClient.registerSms(serverUrl, smsData)
                
                if (success) {
                    Log.d(TAG, "✅ 서버 전송 성공")
                } else {
                    Log.e(TAG, "❌ 서버 전송 실패")
                }
            } catch (e: Exception) {
                Log.e(TAG, "서버 전송 오류: ${e.message}", e)
            }
        }
    }
}

