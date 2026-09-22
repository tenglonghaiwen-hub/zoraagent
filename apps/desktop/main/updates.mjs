// Stable GitHub releases only. Download and installation always require user action.
export function createUpdateChannel({updater,version,enabled,confirmInstall,prepareInstall}) {
  let state={version,phase:enabled?'idle':'disabled',message:enabled?'点击检查更新':'开发/网页模式不支持安装更新'},busy=false;
  const set=(phase,extra={})=>{state={...state,phase,...extra};};
  updater.autoDownload=false;
  updater.autoInstallOnAppQuit=false;
  updater.allowPrerelease=false;
  updater.allowDowngrade=false;
  updater.on('checking-for-update',()=>set('checking',{message:'正在检查更新'}));
  updater.on('update-available',info=>set('available',{nextVersion:info.version,message:`发现新版本 ${info.version}`}));
  updater.on('update-not-available',()=>set('current',{message:'当前已是最新稳定版本'}));
  updater.on('download-progress',info=>set('downloading',{percent:Math.round(info.percent),message:`正在下载 ${Math.round(info.percent)}%`}));
  updater.on('update-downloaded',info=>set('downloaded',{nextVersion:info.version,message:'下载及校验完成，请结束任务后安装'}));
  updater.on('error',error=>set('error',{message:`更新失败：${String(error.message).slice(0,400)}`}));
  return async action=>{
    if(action==='status')return {...state};
    if(!enabled)throw Error('仅安装版支持更新');
    if(busy)throw Error('更新操作正在进行');
    if(!['check','download','install'].includes(action))throw Error('无效更新操作');
    busy=true;
    try {
      if(action==='check'){
        if(state.phase==='downloaded')return {...state};
        await updater.checkForUpdates();
      }
      if(action==='download'){
        if(state.phase!=='available')throw Error('请先检查可用更新');
        set('downloading',{message:'正在开始下载',percent:0});
        await updater.downloadUpdate();
      }
      if(action==='install'){
        if(state.phase!=='downloaded')throw Error('更新尚未下载完成');
        if(await confirmInstall()){
          await prepareInstall();
          updater.quitAndInstall(false,true);
        }
      }
    }catch(error){set('error',{message:`更新失败：${String(error.message).slice(0,400)}`});}
    finally{busy=false;}
    return {...state};
  };
}
