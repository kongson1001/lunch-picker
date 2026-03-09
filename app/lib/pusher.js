import Pusher from 'pusher';

const pusherConfig = {
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
};

let pusher;

if (pusherConfig.appId && pusherConfig.key && pusherConfig.secret) {
  pusher = new Pusher({
    ...pusherConfig,
    useTLS: true,
  });
} else {
  // 빌드 타임용 가짜 객체
  pusher = {
    trigger: () => Promise.resolve(),
  };
}

export const pusherServer = pusher;
