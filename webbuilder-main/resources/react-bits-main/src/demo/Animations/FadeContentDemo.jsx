import { useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';

import RefreshButton from '../../components/common/Preview/RefreshButton';
import CodeExample from '../../components/code/CodeExample';
import useForceRerender from '../../hooks/useForceRerender';
import PropTable from '../../components/common/Preview/PropTable';

import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewSwitch from '../../components/common/Preview/PreviewSwitch';
import Customize from '../../components/common/Preview/Customize';

import FadeContent from '../../content/Animations/FadeContent/FadeContent';
import { fadeContent } from '../../constants/code/Animations/fadeContentCode';

const FadeDemo = () => {
  const [ease, setEase] = useState('power2.out');
  const [blur, setBlur] = useState(false);
  const [delay, setDelay] = useState(0);
  const [duration, setDuration] = useState(1);
  const [threshold, setThreshold] = useState(0.1);
  const [initialOpacity, setInitialOpacity] = useState(0);
  const [disappearEase, setDisappearEase] = useState('power2.in');
  const [disappearAfter, setDisappearAfter] = useState(0);
  const [disappearDuration, setDisappearDuration] = useState(0.5);

  const [key, forceRerender] = useForceRerender();

  const propData = [
    {
      name: 'children',
      type: 'ReactNode',
      default: '',
      description: 'The content to be animated.'
    },
    {
      name: 'blur',
      type: 'boolean',
      default: 'false',
      description: 'Enables a blur effect during the animation.'
    },
    {
      name: 'duration',
      type: 'number',
      default: 1000,
      description: 'Specifies the duration of the fade animation in seconds.'
    },
    {
      name: 'delay',
      type: 'number',
      default: '0',
      description: 'Adds a delay in seconds before triggering the animation.'
    },
    {
      name: 'ease',
      type: 'string',
      default: 'power2.out',
      description: 'GSAP easing function for the fade animation.'
    },
    {
      name: 'threshold',
      type: 'number',
      default: 0.1,
      description: 'IntersectionObserver threshold for triggering the fade animation.'
    },
    {
      name: 'initialOpacity',
      type: 'number',
      default: 0,
      description: 'The starting opacity of the component before it enters the viewport.'
    },
    {
      name: 'className',
      type: 'string',
      default: '',
      description: 'Custom class(es) to be added to the container.'
    },
    {
      name: 'disappearAfter',
      type: 'number',
      default: 0,
      description: 'Time in seconds after which the content will start to disappear. Disables if set to 0.'
    },
    {
      name: 'disappearDuration',
      type: 'number',
      default: 0.5,
      description: 'Duration of the disappearance animation in seconds.'
    },
    {
      name: 'disappearEase',
      type: 'string',
      default: 'power2.in',
      description: 'GSAP easing function for the disappearance animation.'
    }
  ];

  return (
    <TabsLayout>
      <PreviewTab>
        <Box position="relative" className="demo-container" h={400}>
          <FadeContent
            key={key}
            blur={blur}
            duration={duration}
            delay={delay}
            threshold={threshold}
            initialOpacity={initialOpacity}
            disappearAfter={disappearAfter}
            disappearDuration={disappearDuration}
            disappearEase={disappearEase}
            ease={ease}
          >
            <Flex
              fontSize="xl"
              fontWeight="bolder"
              justifyContent="center"
              alignItems="center"
              color="#fff"
              h={100}
              borderRadius="25px"
              border="1px solid #392e4e"
              w={200}
              bg={'#060010'}
            >
              Fade
            </Flex>
          </FadeContent>
          <RefreshButton onClick={forceRerender} />
        </Box>

        <Customize>
          <Flex gap={2} wrap="wrap">
            <Button
              fontSize="xs"
              bg="#170D27"
              borderRadius="10px"
              border="1px solid #271E37"
              _hover={{ bg: '#271E37' }}
              color="#fff"
              h={8}
              onClick={() => {
                setEase(
                  ease === 'power2.out' ? 'bounce.out' : ease === 'bounce.out' ? 'elastic.out(1, 0.3)' : 'power2.out'
                );
                forceRerender();
              }}
            >
              Ease: <Text color={'#a1a1aa'}>&nbsp;{ease}</Text>
            </Button>
            <Button
              fontSize="xs"
              bg="#170D27"
              borderRadius="10px"
              border="1px solid #271E37"
              _hover={{ bg: '#271E37' }}
              color="#fff"
              h={8}
              onClick={() => {
                setDisappearEase(
                  disappearEase === 'power2.in'
                    ? 'bounce.in'
                    : disappearEase === 'bounce.in'
                      ? 'elastic.in(1, 0.3)'
                      : 'power2.in'
                );
                forceRerender();
              }}
            >
              Disappear Ease: <Text color={'#a1a1aa'}>&nbsp;{disappearEase}</Text>
            </Button>
          </Flex>

          <PreviewSwitch
            title="Enable Blur"
            isChecked={blur}
            onChange={checked => {
              setBlur(checked);
              forceRerender();
            }}
          />

          <PreviewSlider
            title="Duration"
            min={0.5}
            max={3}
            step={0.1}
            value={duration}
            valueUnit="s"
            onChange={val => {
              setDuration(val);
              forceRerender();
            }}
          />

          <PreviewSlider
            title="Delay"
            min={0}
            max={2}
            step={0.1}
            value={delay}
            valueUnit="s"
            onChange={val => {
              setDelay(val);
              forceRerender();
            }}
          />

          <PreviewSlider
            title="Threshold"
            min={0.1}
            max={1}
            step={0.1}
            value={threshold}
            onChange={val => {
              setThreshold(val);
              forceRerender();
            }}
          />

          <PreviewSlider
            title="Initial Opacity"
            min={0}
            max={1}
            step={0.1}
            value={initialOpacity}
            onChange={val => {
              setInitialOpacity(val);
              forceRerender();
            }}
          />

          <PreviewSlider
            title="Disappear After"
            min={0}
            max={5}
            step={0.1}
            value={disappearAfter}
            onChange={val => {
              setDisappearAfter(val);
              forceRerender();
            }}
          />

          <PreviewSlider
            title="Disappear Duration"
            min={0.5}
            max={3}
            step={0.1}
            value={disappearDuration}
            onChange={val => {
              setDisappearDuration(val);
              forceRerender();
            }}
          />
        </Customize>

        <PropTable data={propData} />
      </PreviewTab>

      <CodeTab>
        <CodeExample codeObject={fadeContent} />
      </CodeTab>
    </TabsLayout>
  );
};

export default FadeDemo;
