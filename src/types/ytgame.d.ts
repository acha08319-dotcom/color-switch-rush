// Minimal ambient types for the YouTube Playables SDK (window.ytgame).
// Full definitions: https://www.youtube.com/playablesportal/static/youtube_ytgame_web_deploy_mpm_files/index.d.ts
declare global {
  namespace ytgame {
    const IN_PLAYABLES_ENV: boolean;
    const SDK_VERSION: string;

    namespace game {
      function firstFrameReady(): void;
      function gameReady(): void;
      function loadData(): Promise<string>;
      function saveData(data: string): Promise<void>;
    }

    namespace system {
      function isAudioEnabled(): boolean;
      function onAudioEnabledChange(cb: (enabled: boolean) => void): () => void;
      function onPause(cb: () => void): () => void;
      function onResume(cb: () => void): () => void;
      function getLanguage(): Promise<string>;
    }

    namespace engagement {
      enum ContentType {
        PLAYABLE = "PLAYABLE",
        VIDEO = "VIDEO",
      }
      interface Score { value: number }
      interface Content { id: string; contentType?: ContentType }
      function sendScore(score: Score): Promise<void>;
      function openYTContent(content: Content): Promise<void>;
    }

    namespace ads {
      function requestInterstitialAd(): Promise<void>;
      function requestRewardedAd(rewardId: string): Promise<boolean>;
    }

    namespace health {
      function logError(): void;
      function logWarning(): void;
    }
  }

  interface Window {
    ytgame?: typeof ytgame;
  }
}

export {};
