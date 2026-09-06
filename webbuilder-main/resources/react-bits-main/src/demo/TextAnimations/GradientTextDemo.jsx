import { useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';

import CodeExample from '../../components/code/CodeExample';
import PropTable from '../../components/common/Preview/PropTable';

import Customize from '../../components/common/Preview/Customize';
import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewInput from '../../components/common/Preview/PreviewInput';

import GradientText from '../../content/TextAnimations/GradientText/GradientText';
import { gradientText } from '../../constants/code/TextAnimations/gradientTextCode';

const GradientTextDemo = () => {
  const [colors, setColors] = useState('#40ffaa, #4079ff, #40ffaa, #4079ff, #40ffaa');
  const [speed, setSpeed] = useState(3);

  const gradientPreview = colors.split(',').map(color => color.trim());

  const propData = [
    {
      name: 'children',
      type: 'ReactNode',
      default: '-',
      description: 'The content to be displayed inside the gradient text.'
    },
    {
      name: 'className',
      type: 'string',
      default: "''",
      description: 'Adds custom classes to the root element for additional styling.'
    },
    {
      name: 'colors',
      type: 'string[]',
      default: `["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]`,
      description: 'Defines the gradient colors for the text or border.'
    },
    {
      name: 'animationSpeed',
      type: 'number',
      default: '8',
      description: 'The duration of the gradient animation in seconds.'
    },
    {
      name: 'showBorder',
      type: 'boolean',
      default: 'false',
      description: 'Determines whether a border with the gradient effect is displayed.'
    }
  ];

  return (
    <TabsLayout>
      <PreviewTab>
        <Box position="relative" className="demo-container" minH={400}>
          <Text fontSize={'3rem'} as="div">
            <GradientText colors={colors.split(',')} animationSpeed={speed} showBorder={false}>
              A Splash Of Color!
            </GradientText>
          </Text>
        </Box>

        <Customize>
          <PreviewSlider
            title="Loop Duration"
            min={1}
            max={10}
            step={0.5}
            value={speed}
            onChange={setSpeed}
            valueUnit="s"
          />

          <PreviewInput
            title="Colors"
            maxLength={100}
            placeholder="Enter colors separated by commas"
            onChange={val => setColors(val)}
            value={colors}
          />
          <Box
            bg={`linear-gradient(to right, ${gradientPreview.join(', ')})`}
            w="300px"
            marginLeft="calc(2rem + 24px)"
            h="12px"
            borderRadius="md"
            border="1px solid #271E37"
          />
        </Customize>

        <PropTable data={propData} />
      </PreviewTab>

      <CodeTab>
        <CodeExample codeObject={gradientText} />
      </CodeTab>
    </TabsLayout>
  );
};

export default GradientTextDemo;
