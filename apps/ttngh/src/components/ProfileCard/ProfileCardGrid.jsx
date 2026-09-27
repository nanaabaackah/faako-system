import ProfileCard from "./ProfileCard.jsx";

export default function ProfileCardGrid({ members }) {
  return (
    <div className="profile-card-grid">
      {members.map((member) => (
        <ProfileCard key={member.name} avatarUrl={member.image} name={member.name} title={member.role} />
      ))}
    </div>
  );
}
