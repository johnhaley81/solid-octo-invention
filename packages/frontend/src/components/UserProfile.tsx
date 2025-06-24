import React from 'react';
import { useGetUserByIdQuery } from '../generated/graphql';

interface UserProfileProps {
  userId: string;
}

/**
 * Example component demonstrating typed GraphQL hooks
 * This component uses the generated typed hooks from GraphQL Code Generator
 */
export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { data, loading, error } = useGetUserByIdQuery({
    variables: { id: userId },
  });

  if (loading) return <div>Loading user profile...</div>;
  if (error) return <div>Error loading user: {error.message}</div>;
  if (!data?.userById) return <div>User not found</div>;

  const user = data.userById;

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Auth Method: {user.authMethod}</p>
      {user.avatarUrl && (
        <img src={user.avatarUrl} alt={`${user.name}'s avatar`} className="avatar" />
      )}
      <p>Created: {new Date(user.createdAt).toLocaleDateString()}</p>
      <p>Updated: {new Date(user.updatedAt).toLocaleDateString()}</p>
    </div>
  );
};

export default UserProfile;
