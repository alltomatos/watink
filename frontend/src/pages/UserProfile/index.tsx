/* @jsxImportSource react */
import React from "react";
import { i18n } from "../../translate/i18n";

import {
  PageContainer,
  PageHeader,
  PageContent,
} from "../../components/ui/page-layout";

import { useUserProfile } from "./hooks/useUserProfile";
import { ProfileAvatarCard } from "./components/ProfileAvatarCard";
import { ProfileFormCard } from "./components/ProfileFormCard";

const UserProfile = () => {
  const {
    user,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    fileInputRef,
    profileImage,
    initialValues,
    handleUpdateUser,
    handleUploadImage,
  } = useUserProfile();

  return (
    <PageContainer>
      <PageHeader
        title={i18n.t("userProfile.title")}
        description="Gerencie suas informações pessoais e credenciais de acesso"
      />

      <PageContent className="max-w-3xl pb-20">
        <div className="grid gap-6">
          <ProfileAvatarCard
            profileImage={profileImage}
            userName={user?.name}
            userProfile={user?.profile}
            fileInputRef={fileInputRef}
            onUpload={handleUploadImage}
          />

          <ProfileFormCard
            initialValues={initialValues}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            onSubmit={handleUpdateUser}
          />
        </div>
      </PageContent>
    </PageContainer>
  );
};

export default UserProfile;
