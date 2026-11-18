type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

export const capacitor = (): CapacitorGlobal | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return (window as { Capacitor?: CapacitorGlobal }).Capacitor ?? null
}

export const isNativeApp = (): boolean => capacitor()?.isNativePlatform?.() === true

export const shareDownload = async (filename: string, blob: Blob) => {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Cache })
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  await Share.share({ title: filename, files: [uri], dialogTitle: filename })
}

export const listenForBack = async (onBack: () => boolean) => {
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', () => {
    if (!onBack()) {
      void App.exitApp()
    }
  })
}
