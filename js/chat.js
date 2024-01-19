// Global objects
var speechRecognizer
var avatarSynthesizer
var peerConnection
var messages = []
var dataSources = []
var enableQuickReply = false
var quickReplies = [ 'Let me take a look.', 'Let me check.', 'One moment, please.' ]
var speakingThreads = 0

// Logger
const log = msg => {
    document.getElementById('logging').innerHTML += msg + '<br>'
}

// Setup WebRTC
function setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential) {
    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [ iceServerUrl ],
            username: iceServerUsername,
            credential: iceServerCredential
        }]
    })

    // Fetch WebRTC video stream and mount it to an HTML video element
    peerConnection.ontrack = function (event) {
        // Clean up existing video element if there is any
        remoteVideoDiv = document.getElementById('remoteVideo')
        for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
            if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
            }
        }

        if (event.track.kind === 'audio') {
            let audioElement = document.createElement('audio')
            audioElement.id = 'audioPlayer'
            audioElement.srcObject = event.streams[0]
            audioElement.autoplay = true

            audioElement.onplaying = () => {
                log(`WebRTC ${event.track.kind} channel connected.`)
            }

            document.getElementById('remoteVideo').appendChild(audioElement)
        }

        if (event.track.kind === 'video') {
            let videoElement = document.createElement('video')
            videoElement.id = 'videoPlayer'
            videoElement.srcObject = event.streams[0]
            videoElement.autoplay = true
            videoElement.playsInline = true

            videoElement.onplaying = () => {
                log(`WebRTC ${event.track.kind} channel connected.`)
                document.getElementById('startMicrophone').disabled = false
                document.getElementById('stopSession').disabled = false
            }

            document.getElementById('remoteVideo').appendChild(videoElement)
        }
    }

    // Make necessary update to the web page when the connection state changes
    peerConnection.oniceconnectionstatechange = e => {
        console.log("WebRTC status: " + peerConnection.iceConnectionState)

        if (peerConnection.iceConnectionState === 'connected') {
            document.getElementById('configuration').hidden = true
        }

        if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed') {
            document.getElementById('configuration').hidden = false
        }
    }

    // Offer to receive 1 audio, and 1 video track
    peerConnection.addTransceiver('video', { direction: 'sendrecv' })
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

    // start avatar, establish WebRTC connection
    avatarSynthesizer.startAvatarAsync(peerConnection).then((r) => {
        console.log("Avatar started.")
    }).catch(
        (error) => {
            console.log("[" + (new Date()).toISOString() + "] Avatar failed to start. Error: " + error)
            document.getElementById('startSession').disabled = false
            document.getElementById('configuration').hidden = false
        }
    )
}

// Initialize messages
function initMessages() {
    messages = []

    if (dataSources.length === 0) {
        let systemPrompt = document.getElementById('prompt').value
        let systemMessage = {
            role: 'system',
            content: systemPrompt
        }

        messages.push(systemMessage)
    }
}

// Do HTML encoding on given text
function htmlEncode(text) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };
  
    return String(text).replace(/[&<>"'\/]/g, (match) => entityMap[match])
}

// Speak the given text
function speak(text, endingSilenceMs = 0) {
    let ttsVoice = "en-US-JennyNeural"
    let chatHistoryTextArea = document.getElementById('chatHistory')
    chatHistoryTextArea.innerHTML += `Assistant: ${text}\n\n`
    chatHistoryTextArea.scrollTop = chatHistoryTextArea.scrollHeight

    // If there is any speaking thread, stop it
    if (speakingThreads > 0) {
        stopSpeaking()
    }

    speakingThreads++
    let ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:leadingsilence-exact value='0'/>${htmlEncode(text)}</voice></speak>`
    if (endingSilenceMs > 0) {
        ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:leadingsilence-exact value='0'/>${htmlEncode(text)}<break time='${endingSilenceMs}ms' /></voice></speak>`
    }

    avatarSynthesizer.speakSsmlAsync(ssml).then(
        (result) => {
            speakingThreads--
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                console.log(`Speech synthesized to speaker for text [ ${text} ]`)
            } else {
                console.log(`Error occurred while speaking the SSML.`)
            }
        }).catch(
            (error) => {
                console.log(`Error occurred while speaking the SSML: [ ${error} ]`)
            }
        )
}

function stopSpeaking() {
    avatarSynthesizer.stopSpeakingAsync().then(
        log("[" + (new Date()).toISOString() + "] Stop speaking request sent.")
    ).catch(
        (error) => {
            console.log("Error occurred while stopping speaking: " + error)
        }
    )
}

function getQuickReply() {
    return quickReplies[Math.floor(Math.random() * quickReplies.length)]
}

window.startSession = () => {
    const cogSvcRegion = "westeurope"
    const cogSvcSubKey = "YOUR_cogSvcSubKey"
  

    const speechSynthesisConfig = SpeechSDK.SpeechConfig.fromSubscription(cogSvcSubKey, cogSvcRegion)
    
    speechSynthesisConfig.speechSynthesisVoiceName = "en-US-JennyNeural"

    const talkingAvatarCharacter = "lisa"
    const talkingAvatarStyle = "casual-sitting"
    const avatarConfig = new SpeechSDK.AvatarConfig(talkingAvatarCharacter, talkingAvatarStyle)
    avatarConfig.customized = false
    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig)
    avatarSynthesizer.avatarEventReceived = function (s, e) {
        var offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms."
        if (e.offset === 0) {
            offsetMessage = ""
        }

        console.log("Event received: " + e.description + offsetMessage)
    }

    const speechRecognitionConfig = SpeechSDK.SpeechConfig.fromSubscription(cogSvcSubKey, cogSvcRegion)
    speechRecognitionConfig.speechRecognitionLanguage = "en-US"
    speechRecognizer = new SpeechSDK.SpeechRecognizer(speechRecognitionConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput())

    dataSources = []

    initMessages()

    const iceServerUrl = "turn:relay.communication.microsoft.com:3478"
    const iceServerUsername = "YOUR_iceServerUsername"
    const iceServerCredential = "YOUR_iceServerCredential"

    document.getElementById('startSession').disabled = true
    
    setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential)
}

window.stopSession = () => {
    document.getElementById('startSession').disabled = false
    document.getElementById('startMicrophone').disabled = true
    document.getElementById('stopSession').disabled = true
    speechRecognizer.stopContinuousRecognitionAsync()
    speechRecognizer.close()
    avatarSynthesizer.close()
}

window.clearChatHistory = () => {
    document.getElementById('chatHistory').innerHTML = ''
    initMessages()
}

window.startMicrophone = () => {
    document.getElementById('startMicrophone').disabled = true
    document.getElementById('audioPlayer').play()
    speechRecognizer.recognized = async (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            let userQuery = e.result.text.trim()
            if (userQuery === '') {
                return
            }

            let chatMessage = {
                role: 'user',
                content: userQuery
            }

            messages.push(chatMessage)
            let chatHistoryTextArea = document.getElementById('chatHistory')
            chatHistoryTextArea.innerHTML += "User: " + userQuery + '\n\n'
            chatHistoryTextArea.scrollTop = chatHistoryTextArea.scrollHeight

            // For 'bring your data' scenario, chat API currently has long (4s+) latency
            // We return some quick reply here before the chat API returns to mitigate.
            if (dataSources.length > 0 && enableQuickReply) {
                speak(getQuickReply(), 2000)
            }

            const azureOpenAIEndpoint = "https://xxxxxxx.openai.azure.com/"
            const azureOpenAIApiKey = "YOUR_azureOpenAIApiKey"
            const azureOpenAIDeploymentName = "YOUR_OpenAIDeploymentName"

            let url = "{AOAIEndpoint}/openai/deployments/{AOAIDeployment}/chat/completions?api-version=2023-03-15-preview".replace("{AOAIEndpoint}", azureOpenAIEndpoint).replace("{AOAIDeployment}", azureOpenAIDeploymentName)
            let body = JSON.stringify({
                messages: messages
            })

            if (dataSources.length > 0) {
                url = "{AOAIEndpoint}/openai/deployments/{AOAIDeployment}/extensions/chat/completions?api-version=2023-06-01-preview".replace("{AOAIEndpoint}", azureOpenAIEndpoint).replace("{AOAIDeployment}", azureOpenAIDeploymentName)
                body = JSON.stringify({
                    messages: messages,
                    dataSources: dataSources
                })
            }

            fetch(url, {
                method: 'POST',
                headers: {
                    'api-key': azureOpenAIApiKey,
                    'Content-Type': 'application/json'
                },
                body: body
            })
            .then(response => response.json())
            .then(data => {
                let reply = ''
                if (dataSources.length === 0) {
                    reply = data.choices[0].message.content
                } else {
                    let toolMessage = {
                        role: 'tool',
                        content: data.choices[0].messages[0].content
                    }

                    messages.push(toolMessage)
                    reply = data.choices[0].messages[1].content
                }

                let assistantMessage = {
                    role: 'assistant',
                    content: reply
                }

                messages.push(assistantMessage)
                speak(reply.replace(/\[doc(\d+)\]/g, '').trim())
            })
        }
    }

    speechRecognizer.startContinuousRecognitionAsync()
}
