// ffmpeg -i bg.mp4 \
//   -vf "chromakey=0x00ff00:0.31:0.01,format=rgba,setpts=1.8*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1" \
//   -an -c:v libvpx-vp9 -pix_fmt yuva420p out.webm


// ffmpeg -i bg.mp4 \
//   -vf "chromakey=0x00ff00:0.31:0.01,format=rgba,setpts=1.8*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1" \
//   -an -c:v libvpx-vp9 -pix_fmt yuva420p out.webm


// ffmpeg -i bg.mp4 \
//   -vf "chromakey=0x00ff00:0.31:0.01,format=rgba,setpts=1.8*PTS,minterpolate=fps=40:mi_mode=mci:mc_mode=aobmc:vsbmc=1,scale=-2:720" \
//   -an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 -threads 4 out.webm

ffmpeg -i bg3.mp4 \
-vf "chromakey=0x00ff00:0.31:0.01,format=rgba,setpts=1.8*PTS,minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:vsbmc=1,scale=-2:480" \
-an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -row-mt 1 -threads 4 out.webm