"use client"

import { UserOperationsManagement } from '@/components/UserOperationsManagement/UserOperationsManagement';
import { WelcomeTo } from '@/components/WelcomeTo/WelcomeTo';

export default function HomePage() {

  return (
    <>
      <WelcomeTo/>
      <UserOperationsManagement accountAddress={'hello world'} />
    </>
  );
}
