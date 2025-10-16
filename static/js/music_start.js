const bgm = document.getElementById('bgmPlayer');
//bgmの音量調整
bgm.volume = 0.5;

document.addEventListener('fab:play', () => {
            setTimeout(() => {
                    // BGMを再生
                    bgm.play().catch(error => {
                        console.error("BGMの再生に失敗しました: ", error);
                    });
            }, 100);
        });
document.addEventListener('fab:stop', () => {
            bgm.pause();
            //bgm.currentTime = 0;
});