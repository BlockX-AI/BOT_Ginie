import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';
import { Box } from '@chakra-ui/react';
import { useState } from 'react';

import Customize from '../../components/common/Preview/Customize';
import CodeExample from '../../components/code/CodeExample';
import PropTable from '../../components/common/Preview/PropTable';
import Dependencies from '../../components/code/Dependencies';
import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewSwitch from '../../components/common/Preview/PreviewSwitch';
import BackgroundContent from '@/components/common/Preview/BackgroundContent';

import FloatingLines from '@/content/Backgrounds/FloatingLines/FloatingLines';
import { floatingLines } from '../../constants/code/Backgrounds/floatingLinesCode';

const FloatingLinesDemo = () => {
  const [enabledWaves, setEnabledWaves] = useState(['top', 'middle', 'bottom']);
  const [lineCount, setLineCount] = useState(5);
  const [lineDistance, setLineDistance] = useState(5);
  const [bendRadius, setBendRadius] = useState(5);
  const [bendStrength, setBendStrength] = useState(-0.5);

  const toggleWave = wave => {
    setEnabledWaves(prev => (prev.includes(wave) ? prev.filter(w => w !== wave) : [...prev, wave]));
  };

  const propData = [
    {
      name: 'linesGradient',
      type: 'string[]',
      default: 'undefined',
      description: 'Array of hex color strings for gradient coloring of lines (max 8 colors).'
    },
    {
      name: 'enabledWaves',
      type: "Array<'top' | 'middle' | 'bottom'>",
      default: "['top', 'middle', 'bottom']",
      description: 'Which wave layers to display. Can toggle individual waves on/off.'
    },
    {
      name: 'lineCount',
      type: 'number | number[]',
      default: '[6]',
      description: 'Number of lines per wave. Single number applies to all waves, or array for per-wave control.'
    },
    {
      name: 'lineDistance',
      type: 'number | number[]',
      default: '[5]',
      description: 'Spacing between lines. Single number applies to all waves, or array for per-wave control.'
    },
    {
      name: 'topWavePosition',
      type: '{ x: number; y: number; rotate: number }',
      default: 'undefined',
      description: 'Position and rotation settings for the top wave layer.'
    },
    {
      name: 'middleWavePosition',
      type: '{ x: number; y: number; rotate: number }',
      default: 'undefined',
      description: 'Position and rotation settings for the middle wave layer.'
    },
    {
      name: 'bottomWavePosition',
      type: '{ x: number; y: number; rotate: number }',
      default: '{ x: 2.0, y: -0.7, rotate: -1 }',
      description: 'Position and rotation settings for the bottom wave layer.'
    },
    {
      name: 'animationSpeed',
      type: 'number',
      default: '1',
      description: 'Speed multiplier for the wave animation.'
    },
    {
      name: 'interactive',
      type: 'boolean',
      default: 'true',
      description: 'Whether the lines react to mouse/pointer movement.'
    },
    {
      name: 'bendRadius',
      type: 'number',
      default: '10.0',
      description: 'Radius of the area affected by mouse interaction.'
    },
    {
      name: 'bendStrength',
      type: 'number',
      default: '-5.0',
      description: 'Intensity of the bend effect when interacting with mouse.'
    },
    {
      name: 'mouseDamping',
      type: 'number',
      default: '0.05',
      description: 'Smoothing factor for mouse movement tracking (0-1).'
    },
    {
      name: 'parallax',
      type: 'boolean',
      default: 'true',
      description: 'Enable parallax effect with mouse movement.'
    },
    {
      name: 'parallaxStrength',
      type: 'number',
      default: '0.2',
      description: 'Strength of the parallax effect.'
    },
    {
      name: 'mixBlendMode',
      type: "React.CSSProperties['mixBlendMode']",
      default: "'screen'",
      description: 'CSS mix-blend-mode applied to the canvas element.'
    }
  ];

  return (
    <TabsLayout>
      <PreviewTab>
        <Box position="relative" className="demo-container" h={600} p={0} overflow="hidden">
          <FloatingLines
            enabledWaves={enabledWaves}
            lineCount={lineCount}
            lineDistance={lineDistance}
            bendRadius={bendRadius}
            bendStrength={bendStrength}
          />
          <BackgroundContent pillText="New Background" headline="Waves are cool! Even cooler with lines!" />
        </Box>

        <Customize>
          <PreviewSwitch title="Top Wave" isChecked={enabledWaves.includes('top')} onChange={() => toggleWave('top')} />
          <PreviewSwitch
            title="Middle Wave"
            isChecked={enabledWaves.includes('middle')}
            onChange={() => toggleWave('middle')}
          />
          <PreviewSwitch
            title="Bottom Wave"
            isChecked={enabledWaves.includes('bottom')}
            onChange={() => toggleWave('bottom')}
          />

          <PreviewSlider title="Line Count" min={1} max={20} step={1} value={lineCount} onChange={setLineCount} />
          <PreviewSlider
            title="Line Distance"
            min={1}
            max={100}
            step={0.5}
            value={lineDistance}
            onChange={setLineDistance}
          />
          <PreviewSlider title="Bend Radius" min={1} max={30} step={0.5} value={bendRadius} onChange={setBendRadius} />
          <PreviewSlider
            title="Bend Strength"
            min={-15}
            max={15}
            step={0.5}
            value={bendStrength}
            onChange={setBendStrength}
          />
        </Customize>

        <PropTable data={propData} />
        <Dependencies dependencyList={['three']} />
      </PreviewTab>

      <CodeTab>
        <CodeExample codeObject={floatingLines} />
      </CodeTab>
    </TabsLayout>
  );
};

export default FloatingLinesDemo;
