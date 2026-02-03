import { ref } from 'vue';

const isOpen = ref(false);

export const useRigctldConnectionDialog = () => {
  const open = () => {
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
  };

  return { isOpen, open, close };
};
