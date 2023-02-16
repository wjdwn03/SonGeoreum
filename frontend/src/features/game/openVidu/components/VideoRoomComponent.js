import axios from "../../../../common/api/https";
import { OpenVidu } from "openvidu-browser";
import React, { Component, useLocalStorage } from "react";
import DialogExtensionComponent from "./dialog-extension/DialogExtension";
import StreamComponent from "./stream/StreamComponent";
import "./VideoRoomComponent.css";

import OpenViduLayout from "../layout/openvidu-layout";
import UserModel from "../models/user-model";
import ToolbarComponent from "./toolbar/ToolbarComponent";
import Loading from "./Loading";
import GameBar from "./GameBar";
import { Navigate } from "react-router-dom";
import { ThirtyFpsSelectSharp } from "@mui/icons-material";

var localUser = new UserModel();
const APPLICATION_SERVER_URL =
  process.env.NODE_ENV === "production" ? "" : "https://i8b106.p.ssafy.io";

class VideoRoomComponent extends Component {
  constructor(props) {
    super(props);

    this.hasBeenUpdated = false;
    this.layout = new OpenViduLayout();
    let sessionName = this.props.sessionName
      ? this.props.sessionName
      : "SonGeoreum";
    let userName = window.localStorage.getItem("nickname");
    console.log(this.props.user);
    this.remotes = [];
    this.localUserAccessAllowed = false;
    this.state = {
      mySessionId: sessionName,
      myUserName: userName,
      session: undefined,
      localUser: undefined,
      subscribers: [],
      chatDisplay: "block",
      currentVideoDevice: undefined,
      connectionId: undefined,
      message: "", //
      sessionId: undefined, //
      token: "", //
      playGame: false, //
      goGame: true, // *** 임시 ***
      playersList: null, //
      wordsList: null,
      subToken: undefined, // ?
      imageList: null,
    };
    // this.timer // timer component를 갖고온다면

    this.joinSession = this.joinSession.bind(this);
    this.leaveSession = this.leaveSession.bind(this);
    this.onbeforeunload = this.onbeforeunload.bind(this);
    this.updateLayout = this.updateLayout.bind(this);
    this.camStatusChanged = this.camStatusChanged.bind(this);
    this.micStatusChanged = this.micStatusChanged.bind(this);
    this.nicknameChanged = this.nicknameChanged.bind(this);
    this.toggleFullscreen = this.toggleFullscreen.bind(this);
    this.switchCamera = this.switchCamera.bind(this);
    this.screenShare = this.screenShare.bind(this);
    this.stopScreenShare = this.stopScreenShare.bind(this);
    this.closeDialogExtension = this.closeDialogExtension.bind(this);
    this.toggleChat = this.toggleChat.bind(this);
    this.checkNotification = this.checkNotification.bind(this);
    this.checkSize = this.checkSize.bind(this);
    this.theEndGame = this.theEndGame.bind(this);
    this.getWordsList = this.getWordsList.bind(this);
    this.startSignal = this.startSignal.bind(this);
  }

  componentDidMount() {
    const openViduLayoutOptions = {
      maxRatio: 3 / 2, // The narrowest ratio that will be used (default 2x3)
      minRatio: 9 / 16, // The widest ratio that will be used (default 16x9)
      fixedRatio: false, // If this is true then the aspect ratio of the video is maintained and minRatio and maxRatio are ignored (default false)
      bigClass: "OV_big", // The class to add to elements that should be sized bigger
      bigPercentage: 0.8, // The maximum percentage of space the big ones should take up
      bigFixedRatio: false, // fixedRatio for the big ones
      bigMaxRatio: 3 / 2, // The narrowest ratio to use for the big elements (default 2x3)
      bigMinRatio: 9 / 16, // The widest ratio to use for the big elements (default 16x9)
      bigFirst: true, // Whether to place the big one in the top left (true) or bottom right
      animate: true, // Whether you want to animate the transitions
    };

    this.layout.initLayoutContainer(
      document.getElementById("layout"),
      openViduLayoutOptions
    );
    window.addEventListener("beforeunload", this.onbeforeunload);
    window.addEventListener("resize", this.updateLayout);
    window.addEventListener("resize", this.checkSize);
    console.log("join 하기 전 DidMount");

    this.joinSession();

    // this.timer = setTimeout(() => this.byeBye(), 100000) // 10분의 대기시간 후 나가세요 호출
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.onbeforeunload);
    window.removeEventListener("resize", this.updateLayout);
    window.removeEventListener("resize", this.checkSize);
    // clearTimeout(this.timer); // 타이머 종료
    this.leaveSession();
  }

  onbeforeunload(event) {
    this.leaveSession();
  }

  joinSession() {
    this.OV = new OpenVidu();
    this.OV.enableProdMode();

    this.setState(
      {
        session: this.OV.initSession(),
      },
      async () => {
        this.subscribeToStreamCreated();
        await this.connectToSession();
      }
    );
  }

  async connectToSession() {
    // this.state.token?
    if (this.props.token !== undefined) {
      console.log("여기!! token received: ", this.props.token);
      this.connect(this.props.token);
    } else {
      try {
        var token = await this.getToken();
        this.connect(token);
      } catch (error) {
        Navigate("/");
        // window.location.replace("/")
        console.error(
          "There was an error getting the token:",
          error.code,
          error.message
        );
        if (this.props.error) {
          this.props.error({
            error: error.error,
            messgae: error.message,
            code: error.code,
            status: error.status,
          });
        }
        alert("There was an error getting the token:", error.message);
      }
    }
  }

  connect(token) {
    this.state.session
      .connect(token, { clientData: this.state.myUserName })
      .then(() => {
        this.connectWebCam();
      })
      .catch((error) => {
        window.location.replace("/");
        if (this.props.error) {
          this.props.error({
            error: error.error,
            messgae: error.message,
            code: error.code,
            status: error.status,
          });
        }
        // alert("There was an error connecting to the session:", error.message);
        console.log(
          "There was an error connecting to the session:",
          error.code,
          error.message
        );
      });
  }

  async connectWebCam() {
    await this.OV.getUserMedia({
      audioSource: false,
      videoSource: undefined,
    });
    var devices = await this.OV.getDevices();
    var videoDevices = devices.filter((device) => device.kind === "videoinput");

    let publisher = this.OV.initPublisher(undefined, {
      audioSource: false,
      videoSource: videoDevices[0].deviceId,
      publishAudio: localUser.isAudioActive(),
      publishVideo: localUser.isVideoActive(),
      resolution: "640x480",
      frameRate: 30,
      insertMode: "APPEND",
    });

    if (this.state.session.capabilities.publish) {
      publisher.on("accessAllowed", () => {
        console.log("토큰값을 확인해보자: ", this.state.localUser);
        //이때 커넥션 아이디 생김
        this.state.session.publish(publisher).then(() => {
          this.updateSubscribers();
          console.log("subscriber를 업데이트 했어요: ");
          console.log(this.state.subscribers);

          // if (this.state.subscribers.length > 3) {
          //   console.log("4명이상입니다. 입장할 수 없습니다. -> ", this.state.subscribers.length);
          //   this.leaveSession();
          //   return;
          // } // 백에서 해주고 있는 듯

          this.localUserAccessAllowed = true;
          if (this.props.joinSession) {
            this.props.joinSession();
          }
        });
      });
    }

    localUser.setNickname(this.state.myUserName);
    localUser.setConnectionId(this.state.session.connection.connectionId);
    localUser.setScreenShareActive(false);
    localUser.setStreamManager(publisher);
    this.subscribeToUserChanged();
    this.subscribeToStreamDestroyed();
    this.sendSignalUserChanged({
      isScreenShareActive: localUser.isScreenShareActive(),
    });

    this.setState(
      { currentVideoDevice: videoDevices[0], localUser: localUser },
      () => {
        this.state.localUser.getStreamManager().on("streamPlaying", (e) => {
          this.updateLayout();
          publisher.videos[0].video.parentElement.classList.remove(
            "custom-class"
          );
        });
      }
    );
    if (this.state.goGame === false) {
      if (this.state.playGame === true) {
        this.letsStart();
      }
    }
  }

  updateSubscribers() {
    var subscribers = this.remotes;
    this.setState(
      {
        subscribers: subscribers,
      },
      () => {
        if (this.state.localUser) {
          this.sendSignalUserChanged({
            isAudioActive: this.state.localUser.isAudioActive(false),
            isVideoActive: this.state.localUser.isVideoActive(),
            nickname: this.state.localUser.getNickname(),
            isScreenShareActive: this.state.localUser.isScreenShareActive(),
          });
        }
        this.updateLayout();
      }
    );
  }

  async letsStart() {
    const wordsData = await this.getWordsList();
    return await this.startSignal(wordsData);
  }

  async getWordsList() {
    try {
      const response = await axios.get(
        "/api/words?isRandom=true&isTestable=false&num=12"
      );
      console.log("단어 리스트를 갖고 왔어^^", response.data);
      return response.data;
    } catch (err) {
      console.log("단어 리스트 못갖고 왔어ㅜ", err);
    }
  }

  async startSignal(wordsData) {
    const data = {
      playGame: this.state.playGame,
      playersList: this.state.playersList,
      wordsList: wordsData,
      imageList: this.state.imageList,
    };
    this.state.session
      .signal({
        data: JSON.stringify(data),
        to: [],
        type: "play-game",
      })
      .then(() => {
        console.log("시그널 보내기 성공");
      })
      .catch((error) => {
        console.error(error);
      });
  }
  // }
  // }

  async leaveSession() {
    console.log("이곳을...떠나겠습니다...");
    const mySession = this.state.session;
    const sessionId = this.state.sessionId;

    mySession.disconnect();

    if (mySession) {
      mySession.disconnect();
    }

    if (this.state.playGame || this.state.goGame) {
      try {
        const response = await axios.delete(`/api/game/session/${sessionId}`);
        console.log("나가요~ >> ", response.data.message);
        Navigate("/");
        return response.data;
      } catch (err) {
        console.log("못나감~ >>", err);
      }
    }

    // axios({
    //   url: "/leavsession/checkdata",
    //   method: "post",
    //   data: {
    //     token: this.state.subToken,
    //     connectionID: this.state.localUser.connectionId,
    //     userName: nickname,
    //   },

    //   baseURL: "http://localhost:8110",
    //   //withCredentials: true,
    // }).then(function (response) {
    //   console.log(response.data);
    // });

    // Empty all properties...
    this.OV = null;
    this.setState({
      session: undefined,
      subscribers: [],
      mySessionId: "",
      myUserName: "OpenVidu_User" + Math.floor(Math.random() * 100),
      localUser: undefined,
    });
    if (this.props.leaveSession) {
      this.props.leaveSession();
    }
  }

  // 대기가 길어질 경우, 모두 나가주세요~!
  async byeBye() {
    const sessionId = this.state.sessionId;
    if (this.state.subscribers < 3) {
      try {
        const response = await axios.put(`/api/game/session/${sessionId}`);
        console.log("모두 나가주세요~ >> ");
        this.leaveSession();
        Navigate("/");
        // 음...api 안날리고 여기서 끊어도 되지않을까...leavesession...
        return response.data;
      } catch (err) {
        console.log("안나가지는데요.. >>", err);
      }
    }
  }

  camStatusChanged() {
    localUser.setVideoActive(!localUser.isVideoActive());
    localUser.getStreamManager().publishVideo(localUser.isVideoActive());
    this.sendSignalUserChanged({ isVideoActive: localUser.isVideoActive() });
    this.setState({ localUser: localUser });
  }

  micStatusChanged() {
    localUser.setAudioActive(!localUser.isAudioActive());
    localUser.getStreamManager().publishAudio(localUser.isAudioActive());
    this.sendSignalUserChanged({
      isAudioActive: localUser.isAudioActive(false),
    });
    this.setState({ localUser: localUser });
  }

  nicknameChanged(nickname) {
    let localUser = this.state.localUser;
    localUser.setNickname(nickname);
    this.setState({ localUser: localUser });
    this.sendSignalUserChanged({
      nickname: this.state.localUser.getNickname(),
    });
  }

  deleteSubscriber(stream) {
    const remoteUsers = this.state.subscribers;
    const userStream = remoteUsers.filter(
      (user) => user.getStreamManager().stream === stream
    )[0];
    let index = remoteUsers.indexOf(userStream, 0);
    if (index > -1) {
      remoteUsers.splice(index, 1);
      this.setState({
        subscribers: remoteUsers,
      });
    }
    // if (
    //   (this.state.playGame || this.state.goGame) &&
    //   this.state.subscribers < 3
    // ) {
    //   this.leaveSession();
    // }
  }

  subscribeToStreamCreated() {
    this.state.session.on("streamCreated", (event) => {
      const subscriber = this.state.session.subscribe(event.stream, undefined);
      // var subscribers = this.state.subscribers;
      subscriber.on("streamPlaying", (e) => {
        this.checkSomeoneShareScreen();
        subscriber.videos[0].video.parentElement.classList.remove(
          "custom-class"
        );
      });
      const newUser = new UserModel();
      newUser.setStreamManager(subscriber);
      newUser.setConnectionId(event.stream.connection.connectionId);
      newUser.setType("remote");
      const nickname = event.stream.connection.data.split("%")[0];
      newUser.setNickname(JSON.parse(nickname).clientData);
      this.remotes.push(newUser);
      if (this.localUserAccessAllowed) {
        this.updateSubscribers();
      }
    });
  }

  subscribeToStreamDestroyed() {
    // On every Stream destroyed...
    this.state.session.on("streamDestroyed", (event) => {
      // Remove the stream from 'subscribers' array
      this.deleteSubscriber(event.stream);
      setTimeout(() => {
        this.checkSomeoneShareScreen();
      }, 20);
      event.preventDefault();
      this.updateLayout();
    });
  }

  subscribeToUserChanged() {
    this.state.session.on("signal:userChanged", (event) => {
      let remoteUsers = this.state.subscribers;
      remoteUsers.forEach((user) => {
        if (user.getConnectionId() === event.from.connectionId) {
          const data = JSON.parse(event.data);
          console.log("여기다 여기 EVENTO REMOTE: ", event.data);
          if (data.isAudioActive !== undefined) {
            user.setAudioActive(data.isAudioActive);
          }
          if (data.isVideoActive !== undefined) {
            user.setVideoActive(data.isVideoActive);
          }
          if (data.nickname !== undefined) {
            user.setNickname(data.nickname);
          }
          if (data.isScreenShareActive !== undefined) {
            user.setScreenShareActive(data.isScreenShareActive);
          }
        }
      });
      this.setState(
        {
          subscribers: remoteUsers,
        },
        () => this.checkSomeoneShareScreen()
      );
    });

    this.state.session.on("signal:play-game", (event) => {
      console.log("오케이 가보자고");
      console.log(event.data);
      const data = JSON.parse(event.data);
      console.log(data);
      this.setState({
        goGame: data.playGame,
        playersList: data.playersList,
        wordsList: data.wordsList,
        imageList: data.imageList,
      });
    });
  }

  updateLayout() {
    // if (!this.state.playGame && !this.state.goGame) return;
    setTimeout(() => {
      this.layout.updateLayout();
    }, 20);
  }

  sendSignalUserChanged(data) {
    const signalOptions = {
      data: JSON.stringify(data),
      type: "userChanged",
    };
    this.state.session.signal(signalOptions);
  }

  toggleFullscreen() {
    const document = window.document;
    const fs = document.getElementById("container");
    if (
      !document.fullscreenElement &&
      !document.mozFullScreenElement &&
      !document.webkitFullscreenElement &&
      !document.msFullscreenElement
    ) {
      if (fs.requestFullscreen) {
        fs.requestFullscreen();
      } else if (fs.msRequestFullscreen) {
        fs.msRequestFullscreen();
      } else if (fs.mozRequestFullScreen) {
        fs.mozRequestFullScreen();
      } else if (fs.webkitRequestFullscreen) {
        fs.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  async switchCamera() {
    try {
      const devices = await this.OV.getDevices();
      var videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices && videoDevices.length > 1) {
        var newVideoDevice = videoDevices.filter(
          (device) => device.deviceId !== this.state.currentVideoDevice.deviceId
        );

        if (newVideoDevice.length > 0) {
          // Creating a new publisher with specific videoSource
          // In mobile devices the default and first camera is the front one
          var newPublisher = this.OV.initPublisher(undefined, {
            audioSource: false,
            videoSource: newVideoDevice[0].deviceId,
            publishAudio: localUser.isAudioActive(),
            publishVideo: localUser.isVideoActive(),
            mirror: true,
          });

          //newPublisher.once("accessAllowed", () => {
          await this.state.session.unpublish(
            this.state.localUser.getStreamManager()
          );
          await this.state.session.publish(newPublisher);
          this.state.localUser.setStreamManager(newPublisher);
          this.setState({
            currentVideoDevice: newVideoDevice,
            localUser: localUser,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  screenShare() {
    const videoSource =
      navigator.userAgent.indexOf("Firefox") !== -1 ? "window" : "screen";
    const publisher = this.OV.initPublisher(
      undefined,
      {
        videoSource: videoSource,
        publishAudio: localUser.isAudioActive(),
        publishVideo: localUser.isVideoActive(),
        mirror: false,
      },
      (error) => {
        if (error && error.name === "SCREEN_EXTENSION_NOT_INSTALLED") {
          this.setState({ showExtensionDialog: true });
        } else if (error && error.name === "SCREEN_SHARING_NOT_SUPPORTED") {
          alert("Your browser does not support screen sharing");
        } else if (error && error.name === "SCREEN_EXTENSION_DISABLED") {
          alert("You need to enable screen sharing extension");
        } else if (error && error.name === "SCREEN_CAPTURE_DENIED") {
          alert("You need to choose a window or application to share");
        }
      }
    );

    publisher.once("accessAllowed", () => {
      this.state.session.unpublish(localUser.getStreamManager());
      localUser.setStreamManager(publisher);
      this.state.session.publish(localUser.getStreamManager()).then(() => {
        localUser.setScreenShareActive(true);
        this.setState({ localUser: localUser }, () => {
          this.sendSignalUserChanged({
            isScreenShareActive: localUser.isScreenShareActive(),
          });
        });
      });
    });
    publisher.on("streamPlaying", () => {
      this.updateLayout();
      publisher.videos[0].video.parentElement.classList.remove("custom-class");
    });
  }

  closeDialogExtension() {
    this.setState({ showExtensionDialog: false });
  }

  stopScreenShare() {
    this.state.session.unpublish(localUser.getStreamManager());
    this.connectWebCam();
  }

  checkSomeoneShareScreen() {
    let isScreenShared;
    // return true if at least one passes the test
    isScreenShared =
      this.state.subscribers.some((user) => user.isScreenShareActive()) ||
      localUser.isScreenShareActive();
    const openviduLayoutOptions = {
      maxRatio: 3 / 2,
      minRatio: 9 / 16,
      fixedRatio: isScreenShared,
      bigClass: "OV_big",
      bigPercentage: 0.8,
      bigFixedRatio: false,
      bigMaxRatio: 3 / 2,
      bigMinRatio: 9 / 16,
      bigFirst: true,
      animate: true,
    };
    this.layout.setLayoutOptions(openviduLayoutOptions);
    this.updateLayout();
  }

  toggleChat(property) {
    let display = property;

    if (display === undefined) {
      display = this.state.chatDisplay === "none" ? "block" : "none";
    }
    if (display === "block") {
      this.setState({ chatDisplay: display, messageReceived: false });
    } else {
      console.log("chat", display);
      this.setState({ chatDisplay: display });
    }
    this.updateLayout();
  }

  checkNotification(event) {
    this.setState({
      messageReceived: this.state.chatDisplay === "none",
    });
  }
  checkSize() {
    // if (!this.state.playGame) return;
    if (
      document.getElementById("layout").offsetWidth <= 700 &&
      !this.hasBeenUpdated
    ) {
      this.toggleChat("none");
      this.hasBeenUpdated = true;
    }
    if (
      document.getElementById("layout").offsetWidth > 700 &&
      this.hasBeenUpdated
    ) {
      this.hasBeenUpdated = false;
    }
  }

  // 게임이 끝났을 때 결과창으로 보내주기
  theEndGame() {
    this.leaveSession();
  }

  render() {
    // console.log("여기야", localUser)
    // console.log(localUser.getStreamManager())
    const mySessionId = this.state.mySessionId;
    const localUser = this.state.localUser;
    var chatDisplay = { display: "block" };

    const displayNone = { display: "none" };
    const displayBlock = { display: "block" };

    const gameScreen =
      !this.state.goGame && !this.state.playGame ? displayNone : displayBlock;
    const loadingScreen =
      !this.state.goGame && !this.state.playGame ? displayBlock : displayNone;

    return (
      <div>
        <div style={loadingScreen}>
          <Loading
            subscribers={this.state.subscribers}
            sessionId={this.state.sessionId}
            leaveSession={this.leaveSession}
          />
        </div>
        <div className="container" id="container" style={gameScreen}>
          {/* <div>test</div> */}
          <ToolbarComponent
            sessionId={mySessionId}
            user={localUser}
            // user={this.state.localUser}
            showNotification={this.state.messageReceived}
            camStatusChanged={this.camStatusChanged}
            micStatusChanged={this.micStatusChanged}
            //   screenShare={this.screenShare}
            //   stopScreenShare={this.stopScreenShare}
            //   toggleFullscreen={this.toggleFullscreen}
            //   switchCamera={this.switchCamera}
            leaveSession={this.leaveSession}
            toggleChat={this.toggleChat}
          />

          <DialogExtensionComponent
            showDialog={this.state.showExtensionDialog}
            cancelClicked={this.closeDialogExtension}
          />

          <div id="layout" className="bounds">
            {localUser !== undefined &&
              localUser.getStreamManager() !== undefined && (
                <div
                  className="OT_root OT_publisher custom-class"
                  id="localUser"
                >
                  <StreamComponent
                    user={localUser}
                    handleNickname={this.nicknameChanged}
                  />
                </div>
              )}
            {this.state.subscribers.map((sub, i) => (
              <div
                key={i}
                className="OT_root OT_publisher custom-class"
                id="remoteUsers"
              >
                <StreamComponent
                  user={sub}
                  streamId={sub.streamManager.stream.streamId}
                />
              </div>
            ))}
          </div>
          <div className="sidebar">
            {localUser !== undefined && // *** 임시 ***
              localUser.getStreamManager() !== undefined && (
                <GameBar
                  user={localUser}
                  chatDisplay={this.state.chatDisplay}
                  close={this.toggleChat}
                  messageReceived={this.checkNotification}
                  playersList={this.state.playersList}
                  myNickname={this.state.myUserName}
                  wordsList={this.state.wordsList}
                  leaveSession={this.leaveSession}
                  imageList={this.state.imageList}
                />
              )}
          </div>
        </div>
      </div>
    );
  }

  async getToken() {
    const sessionData = await this.createSession();
    return await this.createToken(sessionData);
  }

  async createSession() {
    try {
      const response = await axios.post("/api/game/session");
      console.log("요청성공 >> ", response.data);
      return response.data; // The sessionId
    } catch (err) {
      alert("게임방 입장에 실패하셨습니다. 다시 시도해주세요:)");
      Navigate("/");
      console.log("요청실패 ㅠㅠ", err);
    }
  }

  async createToken(sessionData) {
    console.log("받아온 데이터 값", sessionData);
    const message = sessionData.message;
    const playGame = sessionData.playGame;
    const playersList = sessionData.playersList;
    const sessionId = sessionData.sessionId;
    const token = sessionData.token;
    const imageList = sessionData.imageList;

    this.setState({
      message: message,
      playGame: playGame,
      playersList: playersList,
      sessionId: sessionId,
      token: token,
      imageList: imageList,
    });

    console.log(imageList);

    // const tokenData = token.split("=");
    // console.log(tokenData);
    // const tokenID = tokenData[tokenData.length - 1];
    // this.state.subToken = tokenID;
    // console.log("토큰이 저장됐습니까? : ", this.state.subToken);
    console.log(this.state.sessionId);
    console.log("게임 시작했니!?!?!?!? ", this.playGame);
    // console.log(token.searchParams);
    return token; // The token
  }
}
export default VideoRoomComponent;
