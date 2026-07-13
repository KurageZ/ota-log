const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..', 'node_modules', 'react-native-image-viewing');

function patchFile(relativePath, replacements) {
  const filePath = path.join(packageRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-react-native-image-viewing] missing ${relativePath}, skipping`);
    return;
  }

  let source = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      throw new Error(`[patch-react-native-image-viewing] expected snippet not found in ${relativePath}`);
    }
    source = source.replace(before, after);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, source);
    console.log(`[patch-react-native-image-viewing] patched ${relativePath}`);
  }
}

patchFile('dist/ImageViewing.d.ts', [
  [
    '    onLongPress?: (image: ImageSource) => void;\n    onImageIndexChange?: (imageIndex: number) => void;\n',
    '    onLongPress?: (image: ImageSource) => void;\n    onTap?: () => void;\n    onImageLoad?: (imageIndex: number) => void;\n    imageHidden?: boolean;\n    onImageIndexChange?: (imageIndex: number) => void;\n',
  ],
  [
    '    onTap?: () => void;\n    onImageIndexChange?: (imageIndex: number) => void;\n',
    '    onTap?: () => void;\n    onImageLoad?: (imageIndex: number) => void;\n    imageHidden?: boolean;\n    onImageIndexChange?: (imageIndex: number) => void;\n',
  ],
]);

patchFile('dist/ImageViewing.js', [
  [
    'function ImageViewing({ images, keyExtractor, imageIndex, visible, onRequestClose, onLongPress = () => { }, onImageIndexChange, animationType = DEFAULT_ANIMATION_TYPE, backgroundColor = DEFAULT_BG_COLOR, presentationStyle, swipeToCloseEnabled, doubleTapToZoomEnabled, delayLongPress = DEFAULT_DELAY_LONG_PRESS, HeaderComponent, FooterComponent, }) {',
    'function ImageViewing({ images, keyExtractor, imageIndex, visible, onRequestClose, onLongPress = () => { }, onTap, onImageLoad, imageHidden, onImageIndexChange, animationType = DEFAULT_ANIMATION_TYPE, backgroundColor = DEFAULT_BG_COLOR, presentationStyle, swipeToCloseEnabled, doubleTapToZoomEnabled, delayLongPress = DEFAULT_DELAY_LONG_PRESS, HeaderComponent, FooterComponent, }) {',
  ],
  [
    'function ImageViewing({ images, keyExtractor, imageIndex, visible, onRequestClose, onLongPress = () => { }, onTap, onImageIndexChange, animationType = DEFAULT_ANIMATION_TYPE, backgroundColor = DEFAULT_BG_COLOR, presentationStyle, swipeToCloseEnabled, doubleTapToZoomEnabled, delayLongPress = DEFAULT_DELAY_LONG_PRESS, HeaderComponent, FooterComponent, }) {',
    'function ImageViewing({ images, keyExtractor, imageIndex, visible, onRequestClose, onLongPress = () => { }, onTap, onImageLoad, imageHidden, onImageIndexChange, animationType = DEFAULT_ANIMATION_TYPE, backgroundColor = DEFAULT_BG_COLOR, presentationStyle, swipeToCloseEnabled, doubleTapToZoomEnabled, delayLongPress = DEFAULT_DELAY_LONG_PRESS, HeaderComponent, FooterComponent, }) {',
  ],
  [
    'renderItem={({ item: imageSrc }) => (<ImageItem onZoom={onZoom} imageSrc={imageSrc} onRequestClose={onRequestCloseEnhanced} onLongPress={onLongPress} delayLongPress={delayLongPress} swipeToCloseEnabled={swipeToCloseEnabled} doubleTapToZoomEnabled={doubleTapToZoomEnabled}/>)}',
    'renderItem={({ item: imageSrc, index }) => (<ImageItem onZoom={onZoom} imageSrc={imageSrc} onRequestClose={onRequestCloseEnhanced} onLongPress={onLongPress} onTap={onTap} onLoad={() => { if (typeof onImageLoad === "function") { onImageLoad(index); } }} imageHidden={imageHidden} delayLongPress={delayLongPress} swipeToCloseEnabled={swipeToCloseEnabled} doubleTapToZoomEnabled={doubleTapToZoomEnabled}/>)}',
  ],
  [
    'renderItem={({ item: imageSrc }) => (<ImageItem onZoom={onZoom} imageSrc={imageSrc} onRequestClose={onRequestCloseEnhanced} onLongPress={onLongPress} onTap={onTap} delayLongPress={delayLongPress} swipeToCloseEnabled={swipeToCloseEnabled} doubleTapToZoomEnabled={doubleTapToZoomEnabled}/>)}',
    'renderItem={({ item: imageSrc, index }) => (<ImageItem onZoom={onZoom} imageSrc={imageSrc} onRequestClose={onRequestCloseEnhanced} onLongPress={onLongPress} onTap={onTap} onLoad={() => { if (typeof onImageLoad === "function") { onImageLoad(index); } }} imageHidden={imageHidden} delayLongPress={delayLongPress} swipeToCloseEnabled={swipeToCloseEnabled} doubleTapToZoomEnabled={doubleTapToZoomEnabled}/>)}',
  ],
  [
    'onLoad={() => { if (typeof onImageLoad === "function") { onImageLoad(index); } }} delayLongPress=',
    'onLoad={() => { if (typeof onImageLoad === "function") { onImageLoad(index); } }} imageHidden={imageHidden} delayLongPress=',
  ],
]);

patchFile('dist/components/StatusBarManager.js', [
  [
    '    //Can\'t get an actual state of app status bar with default RN. Gonna rely on "presentationStyle === overFullScreen" prop and guess application status bar state to be visible in this case.\n    StatusBar.setHidden(true);\n    useEffect(() => {\n        return () => StatusBar.setHidden(false);\n    }, []);\n    return null;\n',
    '    // Keep the app status bar state stable; hiding it shifts the underlying Android screen after source measurement.\n    return null;\n',
  ],
]);

for (const platform of ['ios', 'android']) {
  patchFile(`dist/components/ImageItem/ImageItem.${platform}.d.ts`, [
    [
      '    onLongPress: (image: ImageSource) => void;\n    delayLongPress: number;\n',
      '    onLongPress: (image: ImageSource) => void;\n    onTap?: () => void;\n    onLoad?: () => void;\n    imageHidden?: boolean;\n    delayLongPress: number;\n',
    ],
    [
      '    onTap?: () => void;\n    delayLongPress: number;\n',
      '    onTap?: () => void;\n    onLoad?: () => void;\n    imageHidden?: boolean;\n    delayLongPress: number;\n',
    ],
    [
      '    onLoad?: () => void;\n    delayLongPress: number;\n',
      '    onLoad?: () => void;\n    imageHidden?: boolean;\n    delayLongPress: number;\n',
    ],
    [
      'doubleTapToZoomEnabled, }: Props)',
      'doubleTapToZoomEnabled, onTap, onLoad, imageHidden, }: Props)',
    ],
    [
      'doubleTapToZoomEnabled, onTap, }: Props)',
      'doubleTapToZoomEnabled, onTap, onLoad, imageHidden, }: Props)',
    ],
    [
      'doubleTapToZoomEnabled, onTap, onLoad, }: Props)',
      'doubleTapToZoomEnabled, onTap, onLoad, imageHidden, }: Props)',
    ],
  ]);
}

patchFile('dist/hooks/useDoubleTapToZoom.d.ts', [
  [
    'declare function useDoubleTapToZoom(scrollViewRef: React.RefObject<ScrollView>, scaled: boolean, screen: Dimensions): (event: NativeSyntheticEvent<NativeTouchEvent>) => void;',
    'declare function useDoubleTapToZoom(scrollViewRef: React.RefObject<ScrollView>, scaled: boolean, screen: Dimensions, doubleTapToZoomEnabled?: boolean, onTap?: () => void): (event: NativeSyntheticEvent<NativeTouchEvent>) => void;',
  ],
]);

patchFile('dist/hooks/useDoubleTapToZoom.js', [
  [
    'import { useCallback } from "react";',
    'import { useCallback, useEffect, useRef } from "react";',
  ],
  [
    'function useDoubleTapToZoom(scrollViewRef, scaled, screen) {\n    const handleDoubleTap = useCallback((event) => {',
    'function useDoubleTapToZoom(scrollViewRef, scaled, screen, doubleTapToZoomEnabled = true, onTap) {\n    const singleTapTimeoutRef = useRef(null);\n    useEffect(() => () => {\n        if (singleTapTimeoutRef.current) {\n            clearTimeout(singleTapTimeoutRef.current);\n        }\n    }, []);\n    const handleDoubleTap = useCallback((event) => {',
  ],
  [
    '        if (lastTapTS && nowTS - lastTapTS < DOUBLE_TAP_DELAY) {\n            const { pageX, pageY } = event.nativeEvent;',
    '        if (doubleTapToZoomEnabled && lastTapTS && nowTS - lastTapTS < DOUBLE_TAP_DELAY) {\n            if (singleTapTimeoutRef.current) {\n                clearTimeout(singleTapTimeoutRef.current);\n                singleTapTimeoutRef.current = null;\n            }\n            const { pageX, pageY } = event.nativeEvent;',
  ],
  [
    '        }\n        else {\n            lastTapTS = nowTS;\n        }\n    }, [scaled]);',
    '            lastTapTS = null;\n        }\n        else {\n            lastTapTS = nowTS;\n            if (typeof onTap === "function") {\n                if (singleTapTimeoutRef.current) {\n                    clearTimeout(singleTapTimeoutRef.current);\n                }\n                singleTapTimeoutRef.current = setTimeout(() => {\n                    singleTapTimeoutRef.current = null;\n                    onTap();\n                }, doubleTapToZoomEnabled ? DOUBLE_TAP_DELAY : 0);\n            }\n        }\n    }, [scaled, doubleTapToZoomEnabled, onTap]);',
  ],
]);

patchFile('dist/components/ImageItem/ImageItem.ios.js', [
  [
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, imageHidden, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
  ],
  [
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, imageHidden, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
  ],
  [
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, imageHidden, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
  ],
  [
    '    const handleDoubleTap = useDoubleTapToZoom(scrollViewRef, scaled, SCREEN);',
    '    const handleDoubleTap = useDoubleTapToZoom(scrollViewRef, scaled, SCREEN, doubleTapToZoomEnabled, onTap);',
  ],
  [
    '<TouchableWithoutFeedback onPress={doubleTapToZoomEnabled ? handleDoubleTap : undefined} onLongPress={onLongPressHandler} delayLongPress={delayLongPress}>',
    '<TouchableWithoutFeedback onPress={handleDoubleTap} onLongPress={onLongPressHandler} delayLongPress={delayLongPress}>',
  ],
  [
    'const imageStylesWithOpacity = { ...imagesStyles, opacity: imageOpacity };\n',
    'const imageStylesWithOpacity = { ...imagesStyles, opacity: imageOpacity };\n    const displayedImageStyles = imageHidden ? { ...imageStylesWithOpacity, opacity: 0 } : imageStylesWithOpacity;\n',
  ],
  [
    '<Animated.Image source={imageSrc} style={imageStylesWithOpacity} onLoad={() => setLoaded(true)}/>',
    '<Animated.Image source={imageSrc} fadeDuration={0} style={displayedImageStyles} onLoad={() => { setLoaded(true); if (typeof onLoad === "function") { onLoad(); } }}/>',
  ],
  [
    '<Animated.Image source={imageSrc} style={imageStylesWithOpacity} onLoad={() => { setLoaded(true); if (typeof onLoad === "function") { onLoad(); } }}/>',
    '<Animated.Image source={imageSrc} fadeDuration={0} style={displayedImageStyles} onLoad={() => { setLoaded(true); if (typeof onLoad === "function") { onLoad(); } }}/>',
  ],
  [
    '<Animated.Image source={imageSrc} fadeDuration={0} style={imageStylesWithOpacity} onLoad={() => { setLoaded(true); if (typeof onLoad === "function") { onLoad(); } }}/>',
    '<Animated.Image source={imageSrc} fadeDuration={0} style={displayedImageStyles} onLoad={() => { setLoaded(true); if (typeof onLoad === "function") { onLoad(); } }}/>',
  ],
]);

patchFile('dist/hooks/usePanResponder.d.ts', [
  [
    '    onLongPress: () => void;\n',
    '    onLongPress: () => void;\n    onTap?: () => void;\n',
  ],
  [
    'delayLongPress, }: Props)',
    'delayLongPress, onTap, }: Props)',
  ],
]);

patchFile('dist/hooks/usePanResponder.js', [
  [
    'const usePanResponder = ({ initialScale, initialTranslate, onZoom, doubleTapToZoomEnabled, onLongPress, delayLongPress, }) => {',
    'const usePanResponder = ({ initialScale, initialTranslate, onZoom, doubleTapToZoomEnabled, onLongPress, delayLongPress, onTap, }) => {',
  ],
  [
    '    let longPressHandlerRef = null;\n    const meaningfulShift = MIN_DIMENSION * 0.01;',
    '    let longPressHandlerRef = null;\n    let didMove = false;\n    const meaningfulShift = MIN_DIMENSION * 0.01;',
  ],
  [
    '            numberInitialTouches = gestureState.numberActiveTouches;\n            if (gestureState.numberActiveTouches > 1)',
    '            numberInitialTouches = gestureState.numberActiveTouches;\n            didMove = false;\n            if (gestureState.numberActiveTouches > 1)',
  ],
  [
    '                cancelLongPressHandle();\n            }',
    '                cancelLongPressHandle();\n                didMove = true;\n            }',
  ],
  [
    '            if (isDoubleTapPerformed) {\n                isDoubleTapPerformed = false;\n            }\n            if (tmpScale > 0) {',
    '            if (isDoubleTapPerformed) {\n                isDoubleTapPerformed = false;\n            }\n            else if (!didMove && numberInitialTouches === 1 && typeof onTap === "function") {\n                onTap();\n            }\n            if (tmpScale > 0) {',
  ],
]);

patchFile('dist/components/ImageItem/ImageItem.android.js', [
  [
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, imageHidden, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
  ],
  [
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, imageHidden, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
  ],
  [
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
    'const ImageItem = ({ imageSrc, onZoom, onRequestClose, onLongPress, onTap, onLoad, imageHidden, delayLongPress, swipeToCloseEnabled = true, doubleTapToZoomEnabled = true, }) => {',
  ],
  [
    '    const onLoaded = useCallback(() => setLoadEnd(true), []);',
    '    const onLoaded = useCallback(() => { setLoadEnd(true); if (typeof onLoad === "function") { onLoad(); } }, [onLoad]);',
  ],
  [
    'const imageStylesWithOpacity = { ...imagesStyles, opacity: imageOpacity };\n',
    'const imageStylesWithOpacity = { ...imagesStyles, opacity: imageOpacity };\n    const displayedImageStyles = imageHidden ? { ...imageStylesWithOpacity, opacity: 0 } : imageStylesWithOpacity;\n',
  ],
  [
    '<Animated.Image {...panHandlers} source={imageSrc} style={imageStylesWithOpacity} onLoad={onLoaded}/>',
    '<Animated.Image {...panHandlers} source={imageSrc} fadeDuration={0} style={displayedImageStyles} onLoad={onLoaded}/>',
  ],
  [
    '<Animated.Image {...panHandlers} source={imageSrc} fadeDuration={0} style={imageStylesWithOpacity} onLoad={onLoaded}/>',
    '<Animated.Image {...panHandlers} source={imageSrc} fadeDuration={0} style={displayedImageStyles} onLoad={onLoaded}/>',
  ],
  [
    '        delayLongPress,\n    });',
    '        delayLongPress,\n        onTap,\n    });',
  ],
]);
