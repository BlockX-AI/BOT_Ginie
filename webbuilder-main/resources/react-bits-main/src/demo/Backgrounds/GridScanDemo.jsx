import { useState } from 'react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';
import { Box, Flex, Input, Text } from '@chakra-ui/react';

import Customize from '../../components/common/Preview/Customize';
import CodeExample from '../../components/code/CodeExample';
import PropTable from '../../components/common/Preview/PropTable';
import Dependencies from '../../components/code/Dependencies';
import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewSwitch from '@/components/common/Preview/PreviewSwitch';

import { gridScan } from '@/constants/code/Backgrounds/gridScanCode';
import { GridScan } from '@/content/Backgrounds/GridScan/GridScan';
import BackgroundContent from '@/components/common/Preview/BackgroundContent';

const GridScanDemo = () => {
  const [lineThickness, setLineThickness] = useState(1);
  const [gridScale, setGridScale] = useState(0.1);
  const [lineJitter, setLineJitter] = useState(0.1);
  const [linesColor, setLinesColor] = useState('#392e4e');
  const [scanColor, setScanColor] = useState('#FF9FFC');
  const [enablePost, setEnablePost] = useState(true);
  const [chromaticAberration, setChromaticAberration] = useState(0.002);
  const [noiseIntensity, setNoiseIntensity] = useState(0.01);
  const [scanGlow, setScanGlow] = useState(0.5);
  const [scanSoftness, setScanSoftness] = useState(2);
  const [enableWebcam, setEnableWebcam] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const propData = [
    { name: 'enableWebcam', type: 'boolean', default: 'false', description: 'Enable face tracking via webcam.' },
    { name: 'showPreview', type: 'boolean', default: 'false', description: 'Show webcam preview/debug HUD.' },
    {
      name: 'modelsPath',
      type: 'string',
      default: 'CDN URL',
      description: 'Path/URL to face-api.js models.'
    },
    { name: 'sensitivity', type: 'number', default: '0.55', description: 'Overall responsiveness to input.' },
    { name: 'lineThickness', type: 'number', default: '1', description: 'Grid line thickness.' },
    { name: 'linesColor', type: 'string', default: "'#392e4e'", description: 'Color of the grid lines.' },
    { name: 'gridScale', type: 'number', default: '0.1', description: 'Grid spacing scale (smaller = denser).' },
    { name: 'lineStyle', type: "'solid' | 'dashed' | 'dotted'", default: "'solid'", description: 'Grid line style.' },
    { name: 'lineJitter', type: 'number', default: '0.1', description: 'Animated jitter along the grid lines.' },
    { name: 'enablePost', type: 'boolean', default: 'true', description: 'Enable post-processing effects.' },
    { name: 'bloomIntensity', type: 'number', default: '0', description: 'Bloom strength.' },
    { name: 'bloomThreshold', type: 'number', default: '0', description: 'Bloom luminance threshold.' },
    { name: 'bloomSmoothing', type: 'number', default: '0', description: 'Bloom threshold smoothing.' },
    {
      name: 'chromaticAberration',
      type: 'number',
      default: '0.002',
      description: 'Chromatic aberration offset (post).'
    },
    { name: 'noiseIntensity', type: 'number', default: '0.01', description: 'Additive film grain intensity.' },
    { name: 'scanColor', type: 'string', default: "'#FF9FFC'", description: 'Color of the scan beam/aura.' },
    { name: 'scanOpacity', type: 'number', default: '0.4', description: 'Opacity of the scan effect.' },
    {
      name: 'scanDirection',
      type: "'forward' | 'backward' | 'pingpong'",
      default: "'pingpong'",
      description: 'Scan motion.'
    },
    { name: 'scanSoftness', type: 'number', default: '2', description: 'Softness of scan band edges.' },
    { name: 'scanGlow', type: 'number', default: '0.5', description: 'Relative width/intensity of glow.' },
    { name: 'scanPhaseTaper', type: 'number', default: '0.9', description: 'Fade-in/out window for the phase.' },
    { name: 'scanDuration', type: 'number', default: '2.0', description: 'Duration of a scan cycle (seconds).' },
    { name: 'scanDelay', type: 'number', default: '2.0', description: 'Delay between scan cycles (seconds).' },
    { name: 'enableGyro', type: 'boolean', default: 'false', description: 'Use device orientation for input.' },
    { name: 'scanOnClick', type: 'boolean', default: 'false', description: 'Trigger a scan when clicking.' },
    { name: 'snapBackDelay', type: 'number', default: '250', description: 'Delay (ms) before input recenters.' },
    { name: 'className', type: 'string', default: "''", description: 'Additional CSS classes.' },
    { name: 'style', type: 'React.CSSProperties', default: '{}', description: 'Inline style overrides.' }
  ];

  return (
    <TabsLayout>
      <PreviewTab>
        <Box position="relative" className="demo-container" h={600} p={0} overflow="hidden">
          <GridScan
            lineThickness={lineThickness}
            gridScale={gridScale}
            lineJitter={lineJitter}
            linesColor={linesColor}
            scanColor={scanColor}
            enablePost={enablePost}
            chromaticAberration={chromaticAberration}
            noiseIntensity={noiseIntensity}
            scanGlow={scanGlow}
            scanSoftness={scanSoftness}
            enableWebcam={enableWebcam}
            showPreview={showPreview}
          />

          <BackgroundContent pillText="New Background" headline="Hold on, scanning for Angular users." />
        </Box>

        <Customize>
          <Flex alignItems="center" mb={4} gap={2}>
            <Text fontSize="sm">Lines Color</Text>
            <Input type="color" value={linesColor} onChange={e => setLinesColor(e.target.value)} width="50px" />
          </Flex>
          <Flex alignItems="center" mb={4} gap={2}>
            <Text fontSize="sm">Scan Color</Text>
            <Input type="color" value={scanColor} onChange={e => setScanColor(e.target.value)} width="50px" />
          </Flex>

          <PreviewSlider
            title="Line Thickness"
            min={1}
            max={4}
            step={0.1}
            value={lineThickness}
            onChange={setLineThickness}
          />

          <PreviewSlider
            title="Grid Scale"
            min={0.02}
            max={0.5}
            step={0.01}
            value={gridScale}
            onChange={setGridScale}
          />

          <PreviewSlider title="Line Jitter" min={0} max={1} step={0.01} value={lineJitter} onChange={setLineJitter} />

          <PreviewSlider title="Scan Glow" min={0.1} max={3} step={0.1} value={scanGlow} onChange={setScanGlow} />

          <PreviewSlider
            title="Scan Softness"
            min={0.1}
            max={4}
            step={0.1}
            value={scanSoftness}
            onChange={setScanSoftness}
          />

          <PreviewSwitch title="Enable Post" isChecked={enablePost} onChange={setEnablePost} />

          <PreviewSlider
            title="Chromatic Aberration"
            min={0}
            max={0.01}
            step={0.0005}
            value={chromaticAberration}
            onChange={setChromaticAberration}
          />

          <PreviewSlider
            title="Noise Intensity"
            min={0}
            max={0.1}
            step={0.005}
            value={noiseIntensity}
            onChange={setNoiseIntensity}
          />

          <PreviewSwitch title="Enable Webcam" isChecked={enableWebcam} onChange={setEnableWebcam} />
          <PreviewSwitch title="Show Preview HUD" isChecked={showPreview} onChange={setShowPreview} />
        </Customize>

        <PropTable data={propData} />
        <Dependencies dependencyList={['three']} />
      </PreviewTab>

      <CodeTab>
        <CodeExample codeObject={gridScan} />
      </CodeTab>
    </TabsLayout>
  );
};

export default GridScanDemo;
