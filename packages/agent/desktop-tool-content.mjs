export function desktopToolContent(name, result) {
  const imageUrl = name === 'desktop_control' && result?.ok !== false && result?.data?.imageUrl;
  if (typeof imageUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imageUrl)) {
    return {trace:result,contentItems:[{type:'inputText',text:JSON.stringify(result ?? null)}]};
  }
  const trace={...result,data:{...result.data,imageUrl:undefined,screenshotAvailable:true}};
  return {trace,contentItems:[{type:'inputText',text:JSON.stringify(trace)},{type:'inputImage',imageUrl}]};
}
