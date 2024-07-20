const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");

let localStream;
let peerConnection;
const signalingServerUrl = "ws://localhost:8080"; 
const signalingSocket = new WebSocket(signalingServerUrl);

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

async function startVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);

    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingSocket.send(
          JSON.stringify({ type: "ice", candidate: event.candidate })
        );
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    signalingSocket.send(JSON.stringify({ type: "offer", offer: offer }));
  } catch (error) {
    console.error("Error accessing media devices or WebRTC:", error);
  }
}

function stopVideo() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localVideo.srcObject = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}

async function handleSignal(signal) {
  try {
    if (signal.type === "offer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal.offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      signalingSocket.send(JSON.stringify({ type: "answer", answer: answer }));
    } else if (signal.type === "answer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal.answer)
      );
    } else if (signal.type === "ice") {
      await peerConnection.addIceCandidate(
        new RTCIceCandidate(signal.candidate)
      );
    }
  } catch (error) {
    console.error("Error handling signaling message:", error);
  }
}

signalingSocket.onopen = () => {
  console.log("Connected to signaling server");
};

signalingSocket.onerror = (error) => {
  console.error("WebSocket error:", error);
};

signalingSocket.onmessage = (event) => {
  try {
    const signal = JSON.parse(event.data);
    handleSignal(signal);
  } catch (error) {
    console.error("Error processing signaling message:", error);
  }
};

startButton.addEventListener("click", startVideo);
stopButton.addEventListener("click", stopVideo);
