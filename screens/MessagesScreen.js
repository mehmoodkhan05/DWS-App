import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../hooks/useProfiles';
import { useMessages } from '../hooks/useMessages';
import { useGroupMessages } from '../hooks/useGroupMessages';
import { Ionicons } from '@expo/vector-icons';

const MessagesScreen = () => {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState('individual');
  const { messages, sendMessage } = useMessages(selectedUserId || undefined);
  const { messages: groupMessages, sendMessage: sendGroupMessage } = useGroupMessages();

  const otherUsers = profiles.filter(p => p.id !== user?.id && p.is_active);
  const selectedUser = profiles.find(p => p.id === selectedUserId);

  const conversationMessages = messages.filter(
    msg =>
      (msg.sender_id === user?.id && msg.recipient_id === selectedUserId) ||
      (msg.sender_id === selectedUserId && msg.recipient_id === user?.id)
  );

  const handleSendMessage = async () => {
    if (activeTab === 'group') {
      if (!messageText.trim()) return;
      try {
        await sendGroupMessage(messageText);
        setMessageText('');
      } catch (error) {
        console.error('Error sending group message:', error);
      }
    } else {
      if (!selectedUserId || !messageText.trim()) return;
      try {
        await sendMessage(selectedUserId, messageText);
        setMessageText('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  if (activeTab === 'group') {
    return (
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'individual' && styles.tabActive]}
            onPress={() => setActiveTab('individual')}
          >
            <Ionicons name="chatbubbles-outline" size={20} />
            <Text style={styles.tabText}>Individual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'group' && styles.tabActive]}
            onPress={() => setActiveTab('group')}
          >
            <Ionicons name="people-outline" size={20} />
            <Text style={styles.tabText}>Group</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={groupMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.messageContainer}>
              <Text style={styles.messageSender}>{item.sender_name || 'Unknown'}</Text>
              <Text style={styles.messageText}>{item.content}</Text>
              <Text style={styles.messageTime}>
                {new Date(item.created_at).toLocaleTimeString()}
              </Text>
            </View>
          )}
          style={styles.messagesList}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            multiline
          />
          <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
            <Ionicons name="send" size={24} color="#d4af37" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'individual' && styles.tabActive]}
          onPress={() => setActiveTab('individual')}
        >
          <Ionicons name="chatbubbles-outline" size={20} />
          <Text style={styles.tabText}>Individual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'group' && styles.tabActive]}
          onPress={() => setActiveTab('group')}
        >
          <Ionicons name="people-outline" size={20} />
          <Text style={styles.tabText}>Group</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <ScrollView style={styles.contactsList}>
          {otherUsers.map((profile) => (
            <TouchableOpacity
              key={profile.id}
              style={[
                styles.contactItem,
                selectedUserId === profile.id && styles.contactItemActive,
              ]}
              onPress={() => setSelectedUserId(profile.id)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{profile.full_name}</Text>
                <Text style={styles.contactRole}>{profile.role}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.chatContainer}>
          {selectedUser ? (
            <>
              <View style={styles.chatHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {selectedUser.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{selectedUser.full_name}</Text>
                  <Text style={styles.contactRole}>{selectedUser.role}</Text>
                </View>
              </View>

              <FlatList
                data={conversationMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.messageBubble,
                      item.sender_id === user?.id ? styles.messageBubbleSent : styles.messageBubbleReceived,
                    ]}
                  >
                    <Text style={styles.messageBubbleText}>{item.content}</Text>
                    <Text style={styles.messageBubbleTime}>
                      {new Date(item.created_at).toLocaleTimeString()}
                    </Text>
                  </View>
                )}
                style={styles.messagesList}
              />

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Type a message..."
                  multiline
                />
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
                  <Ionicons name="send" size={24} color="#d4af37" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Select a contact from the list</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#d4af37',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  contactsList: {
    width: '40%',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  contactItemActive: {
    backgroundColor: '#f3f4f6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  contactRole: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageBubbleSent: {
    alignSelf: 'flex-end',
    backgroundColor: '#d4af37',
  },
  messageBubbleReceived: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
  },
  messageBubbleText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  messageBubbleTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

export default MessagesScreen;
